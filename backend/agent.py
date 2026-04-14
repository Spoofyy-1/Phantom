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
    "type": "click | click_text | type | scroll | navigate | back | press_enter | done | give_up",
    "element_id": null,
    "text": null,
    "direction": null,
    "url": null,
    "reason": null
  }
}

Action type rules:
- "click": set element_id to the number shown in the element list
- "click_text": set text to the EXACT visible label/text of the element to click — use this when click by element_id is not working or when an element is not in the numbered list
- "type": set text to the string to type into the currently focused field
- "scroll": set direction to "up" or "down"
- "navigate": set url to a full URL (include https://)
- "back": go back in browser history
- "press_enter": submit a form or confirm selection
- "ask_user": set text to a question for the human operator. Use this when the site offers multiple products/services/paths and you need the user to choose which one to explore. Keep questions short and specific.
- "done": task completed — set reason to a thorough summary: what the site does, key pages visited, main features, value proposition, and any UX issues noticed
- "give_up": cannot complete — set reason explaining exactly where you got stuck

confusion_score: integer 0-10 (0 = no confusion, 10 = completely stuck)

CRITICAL RULES:
- You MUST take a different action each step. Never repeat the same action twice in a row.
- If click by element_id does not navigate to a new page after 2 tries, switch to click_text using the exact visible text of the link.
- If you have been scrolling, stop and CLICK something.
- "scroll" should only be used to reveal content not yet visible. Use it at most twice before clicking.
- Prioritise clicking links that navigate to new pages.
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
    test_id: str = "",
    response_queues: dict = None,
) -> dict:
    import asyncio as _asyncio
    response_queue = _asyncio.Queue()
    if response_queues is not None:
        response_queues[persona_id] = response_queue

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

        url_history: list[str] = []  # track recent URLs to detect loops
        same_url_streak = 0

        for step in range(MAX_STEPS):
            state = await session.get_page_state()
            elements_text = _format_elements(state["elements"])

            # Anti-loop: track how many consecutive steps on the same URL
            current_url = state["url"]
            if url_history and url_history[-1] == current_url:
                same_url_streak += 1
            else:
                same_url_streak = 0
            url_history.append(current_url)

            # Build a nudge message if stuck on same page too long
            loop_nudge = ""
            if same_url_streak >= 4:
                visited = list(dict.fromkeys(url_history))  # unique, ordered
                loop_nudge = (
                    f"\n\nWARNING: You have been on this same page for {same_url_streak} steps "
                    f"without navigating away. You MUST click a link or button that takes you to "
                    f"a NEW page this step. Do NOT scroll or describe the page again. "
                    f"Pages visited so far: {', '.join(visited[-5:])}"
                )

            # Step-budget pacing nudges
            steps_left = MAX_STEPS - step
            if steps_left <= 3:
                loop_nudge += (
                    f"\n\nFINAL STEPS: You have only {steps_left} step(s) left. "
                    f"You MUST call 'done' RIGHT NOW. Summarise everything you found across all pages visited."
                )

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
                        f"{loop_nudge}"
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
                elif action_type == "click_text":
                    txt = action.get("text", "")
                    if txt:
                        await session.click_by_text(txt)
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
                elif action_type == "ask_user":
                    question = action.get("text", "What should I do?")
                    await on_event({
                        "type": "ask_user",
                        "persona_id": persona_id,
                        "persona_name": persona["name"],
                        "question": question,
                        "screenshot": state["screenshot"],
                    })
                    # Wait for user response (up to 120 seconds)
                    try:
                        user_response = await _asyncio.wait_for(response_queue.get(), timeout=120)
                    except _asyncio.TimeoutError:
                        user_response = "No response from user. Make your best judgment and continue."
                    # Inject user response into history
                    history.append({
                        "role": "user",
                        "content": [{"type": "text", "text": f"The human operator responds: \"{user_response}\""}],
                    })
                elif action_type == "press_enter":
                    await session.press_key("Enter")
            except Exception:
                pass

            # Emit a post-action screenshot so the live view updates immediately
            if action_type not in ("done", "give_up", "ask_user"):
                try:
                    post_screenshot = await session.screenshot()
                    await on_event({
                        "type": "screenshot_update",
                        "persona_id": persona_id,
                        "screenshot": post_screenshot,
                        "url": session.page.url,
                    })
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


def _grade(score: float) -> str:
    if score >= 9.0: return "A"
    if score >= 8.0: return "B"
    if score >= 6.5: return "C"
    if score >= 4.0: return "D"
    return "F"


import math

def _compute_dimensions(persona_results: list[dict]) -> dict:
    """
    Compute 5 UX dimensions (each 0-10) based on established UX methodologies:
    - Task Success (HEART framework)
    - Efficiency (time-on-task / KLM)
    - Clarity (confusion severity + frequency)
    - Error Recovery (Nielsen heuristic #9)
    - Friction Distribution (consistency heuristic)
    """
    total = len(persona_results)
    if total == 0:
        return {
            "task_success": 0, "efficiency": 0, "clarity": 10,
            "error_recovery": 10, "friction_distribution": 10, "overall": 0,
        }

    active = [r for r in persona_results if r["steps_taken"] > 0]
    succeeded = sum(1 for r in persona_results if r["success"])

    # ── 1. Task Success: completion rate ────────────────────────────
    task_success = 10.0 * (succeeded / total)

    # ── 2. Efficiency: steps relative to optimal ────────────────────
    if active:
        steps = [r["steps_taken"] for r in active]
        optimal = min(steps) if len(steps) > 1 else max(5, steps[0] * 0.6)
        avg_steps = sum(steps) / len(steps)
        efficiency = 10.0 * max(0.0, 1.0 - (avg_steps - optimal) / max(optimal, 1))
        efficiency = min(10.0, max(0.0, efficiency))
    else:
        efficiency = 0.0

    # ── 3. Clarity: penalise severity × frequency with log curve ───
    clarity_scores = []
    for r in active:
        events = r["confusion_events"]
        if not events:
            clarity_scores.append(10.0)
        else:
            avg_sev = sum(e["confusion_score"] for e in events) / len(events)
            penalty = avg_sev * math.log2(len(events) + 1)
            clarity_scores.append(max(0.0, 10.0 - min(10.0, penalty)))
    clarity = sum(clarity_scores) / len(clarity_scores) if clarity_scores else 10.0

    # ── 4. Error Recovery: confused personas who still completed ────
    confused_personas = [r for r in active if len(r["confusion_events"]) > 0]
    if confused_personas:
        recovered = sum(1 for r in confused_personas if r["success"])
        error_recovery = 10.0 * (recovered / len(confused_personas))
    else:
        error_recovery = 10.0  # no confusion = perfect recovery

    # ── 5. Friction Distribution: how widespread is confusion ──────
    if total > 0:
        confused_count = sum(1 for r in persona_results if len(r.get("confusion_events", [])) > 0)
        friction_dist = 10.0 * (1.0 - confused_count / total)
    else:
        friction_dist = 10.0

    # ── Overall: weighted combination ──────────────────────────────
    overall = (
        0.30 * task_success +
        0.20 * efficiency +
        0.25 * clarity +
        0.10 * error_recovery +
        0.15 * friction_dist
    )

    # Edge case: if nobody completed the task, cap at 3.0
    if succeeded == 0 and total > 0:
        overall = min(overall, 3.0)

    # Single persona: flag low confidence
    low_confidence = total < 3

    return {
        "task_success": round(task_success, 1),
        "efficiency": round(efficiency, 1),
        "clarity": round(clarity, 1),
        "error_recovery": round(error_recovery, 1),
        "friction_distribution": round(friction_dist, 1),
        "overall": round(overall, 1),
        "low_confidence": low_confidence,
    }


async def _generate_summary(
    client: AsyncOpenAI,
    url: str,
    task: str,
    persona_results: list[dict],
    ux_score: float,
) -> dict:
    """Call GPT-4o-mini to produce a brief summary + actionable recommendations."""
    lines = []
    for r in persona_results:
        status = "completed" if r["success"] else ("errored" if r["steps_taken"] == 0 else "gave up")
        top_confusions = sorted(r["confusion_events"], key=lambda x: x["confusion_score"], reverse=True)[:3]
        confusion_notes = "; ".join(c["confusion_note"] for c in top_confusions) or "none"
        lines.append(
            f"- {r['persona_name']} ({r['persona_id']}): {status} in {r['steps_taken']} steps. "
            f"Top friction: {confusion_notes}"
        )

    prompt = (
        f"You are a UX analyst. A synthetic user test of '{url}' was run.\n"
        f"Task given to AI personas: \"{task}\"\n"
        f"Overall UX score: {ux_score}/10\n\n"
        f"Persona results:\n" + "\n".join(lines) + "\n\n"
        "Write a JSON object with exactly these two keys:\n"
        "  \"summary\": a 2-3 sentence plain-English overall assessment of the UX\n"
        "  \"recommendations\": an array of 3-5 short, specific, actionable improvements (each under 20 words)\n"
        "Respond with ONLY the JSON — no markdown, no explanation."
    )

    try:
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.choices[0].message.content or "{}"
        raw = raw.strip()
        if "```" in raw:
            import re as _re
            blocks = _re.findall(r"```(?:json)?\s*([\s\S]*?)```", raw)
            if blocks:
                raw = blocks[0].strip()
        parsed = json.loads(raw)
        return {
            "summary": str(parsed.get("summary", "")),
            "recommendations": list(parsed.get("recommendations", [])),
        }
    except Exception:
        return {"summary": "", "recommendations": []}


async def run_test(
    test_id: str,
    url: str,
    task: str,
    personas: list[dict],
    on_event: Callable[[dict], Awaitable[None]],
) -> dict:
    await on_event({"type": "test_start", "test_id": test_id, "url": url, "task": task})

    # Import TESTS to get response_queues for this test
    from main import TESTS
    response_queues = TESTS.get(test_id, {}).get("response_queues", {})

    persona_results = await asyncio.gather(*[
        run_persona_session(
            persona_id=p.get("id", ""),
            custom_persona=p.get("custom_persona"),
            url=url,
            task=task,
            on_event=on_event,
            test_id=test_id,
            response_queues=response_queues,
        )
        for p in personas
    ])

    total_personas = len(persona_results)
    succeeded = sum(1 for r in persona_results if r["success"])

    # Compute 5-dimension scoring
    dimensions = _compute_dimensions(persona_results)
    ux_score = dimensions["overall"]

    # Collect top confusion events across all personas
    all_confusion = []
    for r in persona_results:
        for ce in r["confusion_events"]:
            all_confusion.append({**ce, "persona_name": r["persona_name"]})
    all_confusion.sort(key=lambda x: x["confusion_score"], reverse=True)

    # Avg confusion for display
    active = [r for r in persona_results if r["steps_taken"] > 0]
    avg_confusion = (
        sum(r["total_confusion_score"] for r in active) / len(active)
        if active else 0
    )

    # Generate AI summary
    client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    ai_feedback = await _generate_summary(client, url, task, persona_results, ux_score)

    final_results = {
        "test_id": test_id,
        "url": url,
        "task": task,
        "personas": persona_results,
        "succeeded": succeeded,
        "total_personas": total_personas,
        "ux_score": ux_score,
        "grade": _grade(ux_score),
        "avg_confusion": round(avg_confusion, 1),
        "dimensions": {
            "task_success": dimensions["task_success"],
            "efficiency": dimensions["efficiency"],
            "clarity": dimensions["clarity"],
            "error_recovery": dimensions["error_recovery"],
            "friction_distribution": dimensions["friction_distribution"],
        },
        "low_confidence": dimensions["low_confidence"],
        "top_issues": all_confusion[:5],
        "summary": ai_feedback["summary"],
        "recommendations": ai_feedback["recommendations"],
    }

    await on_event({"type": "test_complete", "test_id": test_id, "results": final_results})
    return final_results
