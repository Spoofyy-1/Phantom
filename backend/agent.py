"""
Phantom — Claude-powered browser agent.
Uses OpenAI GPT-4o for vision (screenshot analysis + action decisions).
"""

import asyncio
import json
import os
import re
import time
from typing import Callable, Awaitable, Optional

from openai import AsyncOpenAI

from browser import BrowserSession
from personas import ARCHETYPE_MAP

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
- "done": task completed — set reason explaining what you accomplished
- "give_up": cannot complete — set reason explaining exactly where you got stuck

confusion_score: integer 0-10 (0 = no confusion, 10 = completely stuck)
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
    raw = raw.strip()
    if "```" in raw:
        blocks = re.findall(r"```(?:json)?\s*([\s\S]*?)```", raw)
        if blocks:
            raw = blocks[0].strip()
    match = re.search(r"\{[\s\S]*\}", raw)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return None


def _build_openai_messages(system_prompt: str, history: list[dict], current_user_content: list) -> list[dict]:
    """
    Build the OpenAI messages list.
    System goes first. For history, strip images from older turns to save tokens —
    only the current (latest) user message keeps its screenshot.
    """
    result = [{"role": "system", "content": system_prompt}]

    for msg in history:
        if msg["role"] == "user" and isinstance(msg["content"], list):
            # Strip images from historical user messages
            text_only = [c for c in msg["content"] if c.get("type") == "text"]
            result.append({"role": "user", "content": text_only})
        else:
            result.append(msg)

    # Append current step (with screenshot)
    result.append({"role": "user", "content": current_user_content})
    return result


async def run_persona_session(
    persona_id: str,
    custom_persona: Optional[dict],
    url: str,
    task: str,
    on_event: Callable[[dict], Awaitable[None]],
) -> dict:
    if custom_persona:
        persona = custom_persona
    elif persona_id in ARCHETYPE_MAP:
        persona = ARCHETYPE_MAP[persona_id]
    else:
        raise ValueError(f"Unknown persona: {persona_id}")

    client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])

    session = BrowserSession(headless=True)
    events: list[dict] = []
    confusion_events: list[dict] = []

    system_prompt = persona["system_prompt"] + "\n\n" + ACTION_SCHEMA

    # Conversation history — user/assistant turns only (system is prepended per-call)
    history: list[dict] = []
    start_time = time.time()

    await on_event({
        "type": "persona_start",
        "persona_id": persona_id,
        "persona_name": persona["name"],
    })

    try:
        await session.start(url)

        for step in range(MAX_STEPS):
            state = await session.get_page_state()
            elements_text = _format_elements(state["elements"])

            # Current step user content — screenshot + text
            current_user_content = [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/png;base64,{state['screenshot']}",
                        "detail": "low",  # faster + cheaper; switch to "high" for more accuracy
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

            messages_for_api = _build_openai_messages(system_prompt, history, current_user_content)

            response = await client.chat.completions.create(
                model="gpt-4o",
                max_tokens=512,
                messages=messages_for_api,
            )

            raw_reply = response.choices[0].message.content or ""

            # Add to history (store user turn without screenshot to save memory)
            history.append({
                "role": "user",
                "content": [c for c in current_user_content if c.get("type") == "text"],
            })
            history.append({"role": "assistant", "content": raw_reply})

            parsed = _parse_action(raw_reply)
            if not parsed:
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

            if confusion and confusion_score >= 4:
                confusion_events.append({
                    "step": step + 1,
                    "url": state["url"],
                    "thought": thought,
                    "confusion_note": confusion,
                    "confusion_score": confusion_score,
                    "screenshot": state["screenshot"],
                })

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

            # Execute action
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
                    await session.scroll(action.get("direction", "down"))
                elif action_type == "navigate":
                    nav_url = action.get("url", "")
                    if nav_url:
                        await session.navigate(nav_url)
                elif action_type == "back":
                    await session.go_back()
                elif action_type == "press_enter":
                    await session.press_key("Enter")
            except Exception:
                pass

        # Hit max steps
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
    personas: list[dict],
    on_event: Callable[[dict], Awaitable[None]],
) -> dict:
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

    total_personas = len(persona_results)
    succeeded = sum(1 for r in persona_results if r["success"])
    avg_confusion = (
        sum(r["total_confusion_score"] for r in persona_results) / total_personas
        if total_personas > 0 else 0
    )
    ux_score = max(0, round(10 - avg_confusion, 1))

    all_confusion = []
    for r in persona_results:
        for ce in r["confusion_events"]:
            all_confusion.append({**ce, "persona_name": r["persona_name"]})
    all_confusion.sort(key=lambda x: x["confusion_score"], reverse=True)

    final_results = {
        "test_id": test_id,
        "url": url,
        "task": task,
        "personas": persona_results,
        "succeeded": succeeded,
        "total_personas": total_personas,
        "ux_score": ux_score,
        "avg_confusion": round(avg_confusion, 1),
        "top_issues": all_confusion[:5],
    }

    await on_event({"type": "test_complete", "test_id": test_id, "results": final_results})
    return final_results
