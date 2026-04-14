"""
Phantom — Playwright browser wrapper.
Manages a headed/headless Chromium session and provides
clean async methods for the agent to drive.
"""

import asyncio
import base64
from typing import Optional
from playwright.async_api import async_playwright, Page, Browser, BrowserContext

# Elements to treat as interactive
_SELECTOR = ", ".join([
    'a[href]',
    'button',
    'input:not([type="hidden"])',
    'select',
    'textarea',
    'label',
    'summary',
    '[role="button"]',
    '[role="link"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="menuitem"]',
    '[role="tab"]',
    '[role="option"]',
    '[role="combobox"]',
    '[role="treeitem"]',
    '[role="switch"]',
    '[role="gridcell"]',
    '[onclick]',
    '[tabindex]:not([tabindex="-1"])',
])

_ENUMERATE_JS = """
() => {
    const SELECTOR = %s;
    const els = Array.from(document.querySelectorAll(SELECTOR));
    const seen = new Set(els);

    function extractInfo(el) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const visible = (
            rect.width > 0 && rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0' &&
            rect.top < window.innerHeight + 100 &&
            rect.bottom > -100
        );
        if (!visible) return null;
        const rawText = (
            el.getAttribute('aria-label') ||
            el.getAttribute('title') ||
            el.textContent ||
            el.value ||
            el.placeholder ||
            el.getAttribute('alt') || ''
        ).replace(/\\s+/g, ' ').trim().slice(0, 100);
        return {
            tag: el.tagName.toLowerCase(),
            type: el.type || el.getAttribute('role') || el.tagName.toLowerCase(),
            text: rawText,
            href: el.href || '',
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top + rect.height / 2),
            disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
        };
    }

    const results = els.map(el => extractInfo(el)).filter(Boolean);

    // Second pass: find cursor:pointer elements not already captured
    const cursorCandidates = document.querySelectorAll('div, span, li, img, label, summary');
    for (const el of cursorCandidates) {
        if (seen.has(el)) continue;
        const style = window.getComputedStyle(el);
        if (style.cursor !== 'pointer') continue;
        const info = extractInfo(el);
        if (info) {
            results.push(info);
            seen.add(el);
        }
    }

    return results.slice(0, 100).map((item, i) => ({ ...item, id: i + 1 }));
}
""" % repr(_SELECTOR)


class BrowserSession:
    def __init__(self, headless: bool = True):
        self.headless = headless
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self._element_coords: dict[int, tuple[int, int]] = {}  # id → (x, y)

    async def start(self, url: str) -> None:
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=self.headless,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        )
        self._context = await self._browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
        )
        self.page = await self._context.new_page()
        await self.page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await self._wait_for_settle()

    async def _wait_for_settle(self, timeout: int = 2500) -> None:
        try:
            await self.page.wait_for_load_state("networkidle", timeout=timeout)
        except Exception:
            pass

    # ------------------------------------------------------------------ #
    # State capture
    # ------------------------------------------------------------------ #

    async def screenshot(self) -> str:
        data = await self.page.screenshot(type="png", full_page=False)
        return base64.b64encode(data).decode()

    async def get_interactive_elements(self) -> list[dict]:
        elements = await self.page.evaluate(_ENUMERATE_JS)
        return elements or []

    async def get_page_state(self) -> dict:
        screenshot = await self.screenshot()
        elements = await self.get_interactive_elements()
        self._element_coords = {el["id"]: (el["x"], el["y"]) for el in elements}
        url = self.page.url
        try:
            title = await self.page.title()
        except Exception:
            title = ""
        # Get scroll position so agent knows if it's reached the bottom
        try:
            scroll_info = await self.page.evaluate("""
            () => {
                const scrollY = window.scrollY || window.pageYOffset;
                const viewportH = window.innerHeight;
                const totalH = document.documentElement.scrollHeight;
                const atBottom = (scrollY + viewportH) >= (totalH - 50);
                const pct = totalH > viewportH ? Math.round((scrollY + viewportH) / totalH * 100) : 100;
                return { scrollY: Math.round(scrollY), totalHeight: totalH, viewportHeight: viewportH, atBottom, scrollPercent: pct };
            }
            """)
        except Exception:
            scroll_info = {"scrollY": 0, "totalHeight": 800, "viewportHeight": 800, "atBottom": True, "scrollPercent": 100}
        return {
            "screenshot": screenshot,
            "elements": elements,
            "url": url,
            "title": title,
            "scroll_info": scroll_info,
        }

    # ------------------------------------------------------------------ #
    # Actions
    # ------------------------------------------------------------------ #

    async def click_element(self, element_id: int) -> bool:
        """
        Click using cached coordinates with a multi-strategy fallback chain:
        1. Hover then mouse click (handles hover-reveal menus)
        2. JS dispatchEvent (handles elements that ignore synthetic mouse events)
        3. DOM re-query click (last resort)
        """
        # Strategy 1: hover → mouse.click using cached coords
        coords = self._element_coords.get(element_id)
        if coords:
            try:
                x, y = coords
                await self.page.mouse.move(x, y)
                await asyncio.sleep(0.15)
                await self.page.mouse.click(x, y)
                await asyncio.sleep(0.8)
                await self._wait_for_settle(2000)
                return True
            except Exception:
                pass

        # Strategy 2: JS dispatchEvent by re-querying DOM index
        try:
            result = await self.page.evaluate("""
            (id) => {
                const SELECTOR = %s;
                const els = Array.from(document.querySelectorAll(SELECTOR)).filter(el => {
                    const r = el.getBoundingClientRect();
                    const s = window.getComputedStyle(el);
                    return r.width > 0 && r.height > 0 &&
                           s.visibility !== 'hidden' && s.display !== 'none';
                });
                const t = els[id - 1];
                if (!t) return false;
                t.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
                return true;
            }
            """ % repr(_SELECTOR), element_id)
            if result:
                await asyncio.sleep(0.8)
                await self._wait_for_settle(2000)
                return True
        except Exception:
            pass

        # Strategy 3: JS .click() fallback
        try:
            await self.page.evaluate("""
            (id) => {
                const SELECTOR = %s;
                const els = Array.from(document.querySelectorAll(SELECTOR)).filter(el => {
                    const r = el.getBoundingClientRect();
                    return r.width > 0 && r.height > 0;
                });
                const t = els[id - 1];
                if (t) t.click();
            }
            """ % repr(_SELECTOR), element_id)
            await asyncio.sleep(0.8)
            await self._wait_for_settle(2000)
        except Exception:
            pass

        return False

    async def click_by_text(self, text: str) -> bool:
        """
        Find and click the first visible element whose text/label contains the given string.
        Useful when element_id clicking fails (dynamic content, hover-only elements, etc.)
        """
        # Try Playwright's built-in text locator first
        for locator in [
            self.page.get_by_text(text, exact=True),
            self.page.get_by_text(text, exact=False),
            self.page.get_by_role("link", name=text),
            self.page.get_by_role("button", name=text),
        ]:
            try:
                count = await locator.count()
                if count > 0:
                    el = locator.first
                    await el.scroll_into_view_if_needed()
                    await el.hover()
                    await asyncio.sleep(0.1)
                    await el.click()
                    await asyncio.sleep(0.8)
                    await self._wait_for_settle(2000)
                    return True
            except Exception:
                continue

        # Fallback: scan all elements for partial text match, click by coords
        try:
            coords = await self.page.evaluate("""
            (text) => {
                const lower = text.toLowerCase();
                const all = Array.from(document.querySelectorAll('a, button, [role="button"], [role="link"]'));
                for (const el of all) {
                    const t = (el.textContent || el.getAttribute('aria-label') || '').toLowerCase();
                    if (t.includes(lower)) {
                        const r = el.getBoundingClientRect();
                        if (r.width > 0 && r.height > 0) {
                            return [Math.round(r.left + r.width/2), Math.round(r.top + r.height/2)];
                        }
                    }
                }
                return null;
            }
            """, text)
            if coords:
                await self.page.mouse.move(coords[0], coords[1])
                await asyncio.sleep(0.1)
                await self.page.mouse.click(coords[0], coords[1])
                await asyncio.sleep(0.8)
                await self._wait_for_settle(2000)
                return True
        except Exception:
            pass

        return False

    async def click_coordinates(self, x: int, y: int) -> None:
        await self.page.mouse.move(x, y)
        await asyncio.sleep(0.1)
        await self.page.mouse.click(x, y)
        await asyncio.sleep(0.8)
        await self._wait_for_settle(1500)

    async def type_text(self, text: str) -> None:
        await self.page.keyboard.type(text, delay=30)
        await asyncio.sleep(0.3)

    async def press_key(self, key: str) -> None:
        await self.page.keyboard.press(key)
        await asyncio.sleep(0.5)

    async def scroll(self, direction: str = "down", amount: int = 500) -> None:
        delta = amount if direction == "down" else -amount
        try:
            # Move mouse to center of viewport first so scroll targets the right element
            viewport = self.page.viewport_size or {"width": 1280, "height": 800}
            cx, cy = viewport["width"] // 2, viewport["height"] // 2
            await self.page.mouse.move(cx, cy)
            await asyncio.sleep(0.1)
            await self.page.mouse.wheel(0, delta)
        except Exception:
            pass
        # Fallback: also use JS scrollBy in case mouse.wheel didn't work
        try:
            await self.page.evaluate(f"window.scrollBy(0, {delta})")
        except Exception:
            pass
        await asyncio.sleep(0.5)
        await self._wait_for_settle(800)

    async def navigate(self, url: str) -> None:
        await self.page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await self._wait_for_settle()

    async def go_back(self) -> None:
        await self.page.go_back(wait_until="domcontentloaded", timeout=15000)
        await self._wait_for_settle()

    # ------------------------------------------------------------------ #
    # Accessibility audit
    # ------------------------------------------------------------------ #

    async def run_accessibility_audit(self) -> list[dict]:
        """Inject axe-core and run accessibility checks."""
        try:
            # Inject axe-core from CDN
            await self.page.add_script_tag(url="https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js")
            await asyncio.sleep(0.5)
            results = await self.page.evaluate("() => axe.run().then(r => r.violations)")
            violations = []
            for v in (results or []):
                violations.append({
                    "id": v.get("id", ""),
                    "impact": v.get("impact", ""),
                    "description": v.get("description", ""),
                    "help": v.get("help", ""),
                    "help_url": v.get("helpUrl", ""),
                    "nodes_count": len(v.get("nodes", [])),
                })
            return violations
        except Exception:
            return []

    # ------------------------------------------------------------------ #
    # Cleanup
    # ------------------------------------------------------------------ #

    async def close(self) -> None:
        try:
            if self._browser:
                await self._browser.close()
            if self._playwright:
                await self._playwright.stop()
        except Exception:
            pass
