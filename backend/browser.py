"""
Phantom — Playwright browser wrapper.
Manages a headed/headless Chromium session and provides
clean async methods for the agent to drive.
"""

import asyncio
import base64
from typing import Optional
from playwright.async_api import async_playwright, Page, Browser, BrowserContext


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
            viewport={"width": 1280, "height": 720},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        )
        self.page = await self._context.new_page()
        await self.page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await self._wait_for_settle()

    async def _wait_for_settle(self, timeout: int = 2000) -> None:
        """Wait for network to mostly settle."""
        try:
            await self.page.wait_for_load_state("networkidle", timeout=timeout)
        except Exception:
            pass  # Acceptable — just means the page is still loading non-critical assets

    # ------------------------------------------------------------------ #
    # State capture
    # ------------------------------------------------------------------ #

    async def screenshot(self) -> str:
        """Return base64-encoded PNG screenshot of the viewport."""
        data = await self.page.screenshot(type="png", full_page=False)
        return base64.b64encode(data).decode()

    async def get_interactive_elements(self) -> list[dict]:
        """
        Inject JS to enumerate all visible interactive elements,
        numbered 1..N for Claude to reference.
        """
        elements = await self.page.evaluate("""
        () => {
            const SELECTOR = [
                'a[href]',
                'button',
                'input:not([type="hidden"])',
                'select',
                'textarea',
                '[role="button"]',
                '[role="link"]',
                '[role="checkbox"]',
                '[role="radio"]',
                '[role="menuitem"]',
                '[role="tab"]',
                '[role="option"]',
                '[role="combobox"]',
                '[tabindex]:not([tabindex="-1"])',
            ].join(', ');

            const els = Array.from(document.querySelectorAll(SELECTOR));

            return els
                .map((el, i) => {
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    const visible = (
                        rect.width > 0 &&
                        rect.height > 0 &&
                        style.visibility !== 'hidden' &&
                        style.display !== 'none' &&
                        style.opacity !== '0' &&
                        rect.top < window.innerHeight &&
                        rect.bottom > 0
                    );
                    if (!visible) return null;

                    const rawText = (
                        el.getAttribute('aria-label') ||
                        el.getAttribute('title') ||
                        el.textContent ||
                        el.value ||
                        el.placeholder ||
                        el.getAttribute('alt') ||
                        ''
                    ).replace(/\\s+/g, ' ').trim().slice(0, 100);

                    return {
                        id: i + 1,
                        tag: el.tagName.toLowerCase(),
                        type: el.type || el.getAttribute('role') || el.tagName.toLowerCase(),
                        text: rawText,
                        href: el.href || '',
                        x: Math.round(rect.left + rect.width / 2),
                        y: Math.round(rect.top + rect.height / 2),
                        disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
                    };
                })
                .filter(Boolean)
                .slice(0, 50);
        }
        """)
        return elements or []

    async def get_page_state(self) -> dict:
        """Snapshot: screenshot + elements + url + title."""
        screenshot = await self.screenshot()
        elements = await self.get_interactive_elements()
        # Cache coordinates so click_element can use exact pixel positions
        self._element_coords = {el["id"]: (el["x"], el["y"]) for el in elements}
        url = self.page.url
        try:
            title = await self.page.title()
        except Exception:
            title = ""
        return {
            "screenshot": screenshot,
            "elements": elements,
            "url": url,
            "title": title,
        }

    # ------------------------------------------------------------------ #
    # Actions
    # ------------------------------------------------------------------ #

    async def click_element(self, element_id: int) -> bool:
        """Click an element using the coordinates captured during the last get_page_state call."""
        try:
            coords = self._element_coords.get(element_id)
            if coords:
                x, y = coords
                await self.page.mouse.click(x, y)
                await asyncio.sleep(0.8)
                await self._wait_for_settle(1500)
                return True
            # Fallback: re-query DOM by index if coords are missing
            result = await self.page.evaluate("""
            (id) => {
                const SELECTOR = [
                    'a[href]', 'button', 'input:not([type="hidden"])',
                    'select', 'textarea', '[role="button"]', '[role="link"]',
                    '[role="checkbox"]', '[role="radio"]', '[role="menuitem"]',
                    '[role="tab"]', '[role="option"]', '[role="combobox"]',
                    '[tabindex]:not([tabindex="-1"])',
                ].join(', ');
                const els = Array.from(document.querySelectorAll(SELECTOR)).filter(el => {
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    return rect.width > 0 && rect.height > 0 &&
                           style.visibility !== 'hidden' &&
                           style.display !== 'none';
                });
                const target = els[id - 1];
                if (target) { target.click(); return true; }
                return false;
            }
            """, element_id)
            await asyncio.sleep(0.8)
            await self._wait_for_settle(1500)
            return bool(result)
        except Exception:
            return False

    async def click_coordinates(self, x: int, y: int) -> None:
        await self.page.mouse.click(x, y)
        await asyncio.sleep(0.8)
        await self._wait_for_settle(1500)

    async def type_text(self, text: str) -> None:
        """Type text into the currently focused element."""
        await self.page.keyboard.type(text, delay=30)
        await asyncio.sleep(0.3)

    async def fill_focused(self, text: str) -> None:
        """Clear focused input and type new text."""
        await self.page.keyboard.press("Control+a")
        await self.page.keyboard.press("Delete")
        await self.page.keyboard.type(text, delay=30)

    async def press_key(self, key: str) -> None:
        await self.page.keyboard.press(key)
        await asyncio.sleep(0.5)

    async def scroll(self, direction: str = "down", amount: int = 400) -> None:
        delta = amount if direction == "down" else -amount
        await self.page.mouse.wheel(0, delta)
        await asyncio.sleep(0.4)

    async def navigate(self, url: str) -> None:
        await self.page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await self._wait_for_settle()

    async def go_back(self) -> None:
        await self.page.go_back(wait_until="domcontentloaded", timeout=15000)
        await self._wait_for_settle()

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
