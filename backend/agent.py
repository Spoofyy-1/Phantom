"""
Phantom — Claude-powered browser agent.
Each persona gets its own session; Claude drives Playwright through the site
and logs confusion events in real time.
"""

import asyncio
import json
import os
import re
import time
from typing import Callable, Awaitable, Optional

from anthropic import AsyncAnthropic

from browser import BrowserSession
from personas import ARCHETYPE_MAP

# How many steps before we force-stop a persona session
MAX_STEPS = 25

ACTION_SCHEMA = """
Respond with ONLY a JSON object — no markdown, no explanation:

{
  "thought": "your internal monologue as this persona (1-3 sentences)",
  "confusion": "describe what is confusing you right now, or null if nothing",
  "confusion_score": 0,
  "action": {
    "type": "click | type | scroll | navigate | back | press_enter | done | give_up",
    "element_id": null,
    "text": null,
    "direction": null,
    "url": null,
    "reason": null
  }
}

Action type rules:
- "click": set element_id to the number from the element list
- "type": set text to the string to type into the currently focused/clicked field
- "scroll": set direction to "up" or "down"
- "navigate": set url to a full URL
- "back": go back in browser history
- "press_enter": submit a form or confirm a selection
- "done": task completed successfully — set reason explaining what you accomplished
- "give_up": cannot complete — set reason explaining exactly where you got stuck

confusion_score: integer 0-10 (0 = no confusion, 10 = completely stuck/giving up)
"""


def _format_elements(elements: list[dict]) -> str:
    if not elements:
        return "(no interactive elements detected)"
    lines = []
    for el in elements:
        disabled = " [DISABLED]" if el.get("disabled") else ""
        href = f" → {el['href'][:60]}" if el.get("href") else ""
        lines.append(f"  [{el['id']}] <{el['tag']}> {el.get('text', '(no label)')}{disabled}{href}")
    return "\n".join(lines)


def _parse_action(raw: str) -> Optional[dict]:
    """Extract JSON from the model's response, tolerating minor formatting issues."""
    raw = raw.strip()
    # Strip markdown fences
    if "```" in raw:
        blocks = re.findall(r"```(?:json)?\s*([\s\S]*?)```", raw)
        if blocks:
            raw = blocks[0].strip()
    # Find first {...} block
    match = re.search(r"\{[\s\S]*\}", raw)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return None


async def run_persona_session(
    persona_id: str,
    custom_persona: Optional[dict],
    url: str,
    task: str,
    on_event: Callable[[dict], Awaitable[None]],
) -> dict:
    """
    Run a single persona through the site and return a result dict.
    Calls on_event() with live progress events.
    """
    # Resolve persona
    if custom_persona:
        persona = custom_persona
    elif persona_id in ARCHETYPE_MAP:
        persona = ARCHETYPE_MAP[persona_id]
    else:
        raise ValueError(f"Unknown persona: {persona_id}")

    client = AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    session = BrowserSession(headless=True)
    events: list[dict] = []
    confusion_events: list[dict] = []

    system_prompt = persona["system_prompt"] + "\n\n" + ACTION_SCHEMA

    messages: list[dict] = []
    start_time = time.time()

    await on_event({
        "type": "persona_start",
        "persona_id": persona_id,
        "persona_name": persona["name"],
    })

    try:
        await session.start(url)

        for step in range(MAX_STEPS):
            # -- Capture page state --
            state = await session.get_page_state()
            elements_text = _format_elements(state["elements"])

            user_content = [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": state["screenshot"],
                    },
                },
                {
                    "type": "text",
                    "text": (
                        f"Current URL: {state['url']}\n"
                        f"Page title: {state['title']}\n\n"
                        f"Interactive elements visible on screen:\n{elements_text}\n\n"
                        f"Your task: {task}\n\n"
                        f"Step {step + 1} of {MAX_STEPS}. What do you do next?"
                    ),
                },
            ]

            messages.append({"role": "user", "content": user_content})

            # -- Ask Claude --
            response = await client.messages.create(
                model="claude-opus-4-6",
                max_tokens=512,
                system=system_prompt,
                messages=messages,
            )

            raw_reply = response.content[0].text
            messages.append({"role": "assistant", "content": raw_reply})

            # -- Parse --
            parsed = _parse_action(raw_reply)
            if not parsed:
                # Malformed response — skip step
                continue

            action = parsed.get("action", {})
            action_type = action.get("type", "")
            thought = parsed.get("thought", "")
            confusion = parsed.get("confusion")
            confusion_score = int(parsed.get("confusion_score", 0))

            step_event = {
                "type": "step",
                "persona_id": persona_id,
                "persona_name": persona["name"],
                "step": step + 1,
                "url": state["url"],
                "thought": thought,
                "action_type": action_type,
                "action_target": action.get("element_id") or action.get("text") or action.get("url"),
                "confusion": confusion,
                "confusion_score": confusion_score,
                "screenshot": state["screenshot"],
            }

            events.append(step_event)
            await on_event(step_event)

            # -- Record confusion events --
            if confusion and confusion_score >= 4:
                confusion_events.append({
                    "step": step + 1,
                    "url": state["url"],
                    "thought": thought,
                    "confusion_note": confusion,
                    "confusion_score": confusion_score,
                    "screenshot": state["screenshot"],
                })

            # -- Terminal actions --
            if action_type in ("done", "give_up"):
                result = {
                    "persona_id": persona_id,
                    "persona_name": persona["name"],
                    "persona_avatar": persona.get("avatar", "👤"),
                    "success": action_type == "done",
                    "gave_up": action_type == "give_up",
                    "steps_taken": step + 1,
                    "reason": action.get("reason", ""),
                    "confusion_events": confusion_events,
                    "total_confusion_score": (
                        sum(e["confusion_score"] for e in confusion_events) / max(len(confusion_events), 1)
                    ),
                    "events": events,
                    "duration_seconds": round(time.time() - start_time, 1),
                }
                await on_event({
                    "type": "persona_complete",
                    "persona_id": persona_id,
                    "persona_name": persona["name"],
                    "success": result["success"],
                    "steps": step + 1,
                    "result": result,
                })
                return result

            # -- Execute action --
            try:
                if action_type == "click":
                    eid = action.get("element_id")
                    if eid:
                        await session.click_element(int(eid))
                elif action_type == "type":
                    text = action.get("text", "")
                    if text:
                        await session.type_text(str(text))
                elif action_type == "scroll":
                    direction = action.get("direction", "down")
                    await session.scroll(direction)
                elif action_type == "navigate":
                    nav_url = action.get("url", "")
                    if nav_url:
                        await session.navigate(nav_url)
                elif action_type == "back":
                    await session.go_back()
                elif action_type == "press_enter":
                    await session.press_key("Enter")
            except Exception:
                pass  # Log silently — agent will see the unchanged state next step

        # -- Ran out of steps --
        result = {
            "persona_id": persona_id,
            "persona_name": persona["name"],
            "persona_avatar": persona.get("avatar", "👤"),
            "success": False,
            "gave_up": True,
            "steps_taken": MAX_STEPS,
            "reason": f"Reached maximum step limit ({MAX_STEPS}) without completing the task.",
            "confusion_events": confusion_events,
            "total_confusion_score": (
                sum(e["confusion_score"] for e in confusion_events) / max(len(confusion_events), 1)
            ),
            "events": events,
            "duration_seconds": round(time.time() - start_time, 1),
        }
        await on_event({
            "type": "persona_complete",
            "persona_id": persona_id,
            "persona_name": persona["name"],
            "success": False,
            "steps": MAX_STEPS,
            "result": result,
        })
        return result

    except Exception as e:
        error_result = {
            "persona_id": persona_id,
            "persona_name": persona["name"],
            "persona_avatar": persona.get("avatar", "👤"),
            "success": False,
            "gave_up": True,
            "steps_taken": 0,
            "reason": f"Error during session: {str(e)}",
            "confusion_events": [],
            "total_confusion_score": 0,
            "events": events,
            "duration_seconds": round(time.time() - start_time, 1),
        }
        await on_event({
            "type": "persona_error",
            "persona_id": persona_id,
            "persona_name": persona["name"],
            "error": str(e),
            "result": error_result,
        })
        return error_result
    finally:
        await session.close()


async def run_test(
    test_id: str,
    url: str,
    task: str,
    personas: list[dict],  # list of {id, custom_persona?}
    on_event: Callable[[dict], Awaitable[None]],
) -> dict:
    """
    Run all selected personas sequentially (to avoid overwhelming Railway).
    Returns aggregated results.
    """
    await on_event({"type": "test_start", "test_id": test_id, "url": url, "task": task})

    persona_results = []

    for p in personas:
        result = await run_persona_session(
            persona_id=p.get("id", ""),
            custom_persona=p.get("custom_persona"),
            url=url,
            task=task,
            on_event=on_event,
        )
        persona_results.append(result)

    # Aggregate
    total_personas = len(persona_results)
    succeeded = sum(1 for r in persona_results if r["success"])
    avg_confusion = (
        sum(r["total_confusion_score"] for r in persona_results) / total_personas
        if total_personas > 0 else 0
    )
    ux_score = max(0, round(10 - avg_confusion, 1))

    # Collect top confusion moments
    all_confusion = []
    for r in persona_results:
        for ce in r["confusion_events"]:
            all_confusion.append({**ce, "persona_name": r["persona_name"]})
    all_confusion.sort(key=lambda x: x["confusion_score"], reverse=True)
    top_issues = all_confusion[:5]

    final_results = {
        "test_id": test_id,
        "url": url,
        "task": task,
        "personas": persona_results,
        "succeeded": succeeded,
        "total_personas": total_personas,
        "ux_score": ux_score,
        "avg_confusion": round(avg_confusion, 1),
        "top_issues": top_issues,
    }

    await on_event({"type": "test_complete", "test_id": test_id, "results": final_results})
    return final_results
