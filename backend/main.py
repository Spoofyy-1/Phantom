"""
Phantom — FastAPI backend
Endpoints: expand-persona, list archetypes, run test, stream events, get results
"""

import asyncio
import json
import os
import time
import uuid
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agent import run_test
from personas import get_archetypes, expand_persona

load_dotenv()

app = FastAPI(title="Phantom API", version="1.0.0")

# CORS — allow Vercel frontend + local dev.
# allow_origins doesn't support wildcards; use allow_origin_regex for *.vercel.app.
_extra_origin = os.environ.get("FRONTEND_URL", "")
_static_origins = ["http://localhost:3000", "http://localhost:3001"]
if _extra_origin:
    _static_origins.append(_extra_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_static_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory test store (persists for lifetime of the process)
# Structure: { test_id: { "status": str, "events": list, "results": dict | None } }
TESTS: dict[str, dict] = {}


# ------------------------------------------------------------------ #
# Pydantic models
# ------------------------------------------------------------------ #

class PersonaRef(BaseModel):
    id: str
    custom_persona: Optional[dict] = None


class RunTestRequest(BaseModel):
    url: str
    task: str
    personas: list[PersonaRef]


class ExpandPersonaRequest(BaseModel):
    description: str


class RespondRequest(BaseModel):
    persona_id: str
    response: str


# ------------------------------------------------------------------ #
# Health
# ------------------------------------------------------------------ #

@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": time.time()}


# ------------------------------------------------------------------ #
# Archetypes
# ------------------------------------------------------------------ #

@app.get("/api/archetypes")
async def list_archetypes():
    return {"archetypes": get_archetypes()}


# ------------------------------------------------------------------ #
# Custom persona expansion
# ------------------------------------------------------------------ #

@app.post("/api/expand-persona")
async def expand_persona_endpoint(body: ExpandPersonaRequest):
    if not body.description.strip():
        raise HTTPException(400, "Description cannot be empty")
    if len(body.description) > 500:
        raise HTTPException(400, "Description must be under 500 characters")

    try:
        persona = await expand_persona(body.description)
        return {"persona": persona}
    except Exception as e:
        raise HTTPException(500, f"Failed to expand persona: {str(e)}")


# ------------------------------------------------------------------ #
# Test execution
# ------------------------------------------------------------------ #

@app.post("/api/run-test")
async def start_test(body: RunTestRequest, background_tasks: BackgroundTasks):
    if not body.personas:
        raise HTTPException(400, "At least one persona is required")
    if len(body.personas) > 4:
        raise HTTPException(400, "Maximum 4 personas per test")
    if not body.task.strip():
        raise HTTPException(400, "Task description cannot be empty")

    test_id = str(uuid.uuid4())
    TESTS[test_id] = {
        "status": "running",
        "events": [],
        "results": None,
        "created_at": time.time(),
        "response_queues": {},
    }

    personas_payload = [
        {"id": p.id, "custom_persona": p.custom_persona}
        for p in body.personas
    ]

    async def event_handler(event: dict):
        TESTS[test_id]["events"].append(event)
        if event["type"] == "test_complete":
            TESTS[test_id]["status"] = "complete"
            TESTS[test_id]["results"] = event["results"]

    background_tasks.add_task(
        _run_test_task, test_id, str(body.url), body.task, personas_payload, event_handler
    )

    return {"test_id": test_id}


async def _run_test_task(test_id, url, task, personas, event_handler):
    try:
        await run_test(test_id, url, task, personas, event_handler)
    except Exception as e:
        TESTS[test_id]["status"] = "error"
        TESTS[test_id]["events"].append({
            "type": "error",
            "message": str(e),
        })


# ------------------------------------------------------------------ #
# SSE event stream
# ------------------------------------------------------------------ #

@app.get("/api/test/{test_id}/stream")
async def stream_test_events(test_id: str):
    if test_id not in TESTS:
        raise HTTPException(404, "Test not found")

    async def generate():
        # Send keep-alive comment every 15s so Railway doesn't kill the connection
        last_idx = 0
        last_ping = time.time()

        while True:
            run = TESTS.get(test_id)
            if not run:
                yield "data: {}\n\n"
                break

            events = run["events"]
            new_events = events[last_idx:]

            for event in new_events:
                payload = json.dumps(event)
                yield f"data: {payload}\n\n"
                last_idx += 1

            if run["status"] in ("complete", "error"):
                break

            # Keep-alive ping
            if time.time() - last_ping > 15:
                yield ": ping\n\n"
                last_ping = time.time()

            await asyncio.sleep(0.3)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable Nginx buffering
        },
    )


# ------------------------------------------------------------------ #
# Results (for polling or post-completion fetch)
# ------------------------------------------------------------------ #

@app.post("/api/test/{test_id}/respond")
async def respond_to_question(test_id: str, body: RespondRequest):
    run = TESTS.get(test_id)
    if not run:
        raise HTTPException(404, "Test not found")
    queue = run["response_queues"].get(body.persona_id)
    if not queue:
        raise HTTPException(400, "No pending question for this persona")
    await queue.put(body.response)
    return {"ok": True}


@app.get("/api/test/{test_id}/results")
async def get_test_results(test_id: str):
    run = TESTS.get(test_id)
    if not run:
        raise HTTPException(404, "Test not found")

    return {
        "test_id": test_id,
        "status": run["status"],
        "results": run["results"],
    }


@app.get("/api/test/{test_id}/status")
async def get_test_status(test_id: str):
    run = TESTS.get(test_id)
    if not run:
        raise HTTPException(404, "Test not found")

    return {
        "test_id": test_id,
        "status": run["status"],
        "event_count": len(run["events"]),
    }
