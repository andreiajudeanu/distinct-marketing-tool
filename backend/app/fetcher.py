"""Opens public competitor pages with Playwright and captures text and a screenshot.

No stealth, no CAPTCHA solving: the browser says who it is, respects robots.txt,
and a page that refuses us is reported as refused.
"""

import asyncio
import base64
from dataclasses import dataclass
from typing import Awaitable, Callable
from urllib.parse import urljoin, urlsplit
from urllib.robotparser import RobotFileParser

import httpx
from playwright.async_api import Browser, Error as PlaywrightError, Route, TimeoutError as PlaywrightTimeout, async_playwright
from pydantic import ValidationError

from . import config
from .errors import AnalysisError
from .schemas import PageCapture
from .url_safety import UnsafeUrl, UrlPolicy, cached_policy, check_public_url

AGENT_TOKEN = "DistinctWatch"
USER_AGENT = f"Mozilla/5.0 (compatible; {AGENT_TOKEN}/0.1; competitive research MVP)"
VIEWPORT = {"width": 1280, "height": 800}
ROBOTS_TIMEOUT_SECONDS = 6
MAX_ROBOTS_HOPS = 3
MAX_REDIRECTS = 6
REDIRECT_STATUSES = {301, 302, 303, 307, 308}
SETTLE_TIMEOUT_MS = 4000
JPEG_QUALITY = 55
BLOCKED_STATUSES = {401, 403, 429, 503}
GONE_STATUSES = {404, 410}

RobotsCheck = Callable[[str], Awaitable[tuple[bool, str]]]
FetchFn = Callable[[list[str]], Awaitable[list["FetchedPage"]]]


@dataclass
class FetchedPage:
    url: str
    final_url: str
    status: str
    reason: str = ""
    page: PageCapture | None = None


async def robots_allowed(url: str, policy: UrlPolicy = check_public_url) -> tuple[bool, str]:
    parts = urlsplit(url)
    target = f"{parts.scheme}://{parts.netloc}/robots.txt"
    async with httpx.AsyncClient(timeout=ROBOTS_TIMEOUT_SECONDS, headers={"user-agent": USER_AGENT}) as client:
        try:
            for _ in range(MAX_ROBOTS_HOPS):
                await policy(target)
                response = await client.get(target)
                if not response.is_redirect:
                    break
                target = urljoin(target, response.headers.get("location", ""))
        except UnsafeUrl as error:
            return False, str(error)
        except httpx.HTTPError:
            return False, "robots.txt nu a putut fi citit."
    if response.status_code >= 500 or response.is_redirect:
        return False, "robots.txt nu a putut fi citit."
    if response.status_code >= 400:
        return True, ""
    parser = RobotFileParser()
    parser.parse(response.text.splitlines())
    return (True, "") if parser.can_fetch(AGENT_TOKEN, url) else (False, "Site-ul interzice accesul prin robots.txt.")


def _capture(raw: dict, status: int, screenshot: bytes | None) -> PageCapture:
    fields = {**raw, "http_status": status}
    if screenshot:
        fields["screenshot_jpeg_base64"] = base64.b64encode(screenshot).decode("ascii")
    return PageCapture.model_validate(fields)


async def _walk_redirects(context, url: str, policy: UrlPolicy):
    """Follows redirects by hand and checks every hop before requesting it.

    Chromium does not send followed redirects back through route handlers, so
    letting the browser follow them would reach the address before any check.
    """
    current = url
    for _ in range(MAX_REDIRECTS):
        response = await context.request.get(current, max_redirects=0, timeout=config.PAGE_TIMEOUT_MS)
        location = response.headers.get("location")
        if response.status not in REDIRECT_STATUSES or not location:
            return response, current
        await response.dispose()
        current = urljoin(current, location)
        await policy(current)
    raise UnsafeUrl("Prea multe redirecționări.")


async def _guard_requests(context, policy: UrlPolicy, unsafe: list[str]) -> None:
    async def guard(route: Route) -> None:
        request = route.request
        if request.url.startswith(("data:", "blob:")):
            await route.continue_()
            return
        try:
            await policy(request.url)
        except UnsafeUrl:
            if request.is_navigation_request():
                unsafe.append(request.url)
            await route.abort("blockedbyclient")
            return
        if request.resource_type == "media":
            await route.abort("blockedbyclient")
        elif request.is_navigation_request():
            try:
                response, final_url = await _walk_redirects(context, request.url, policy)
            except UnsafeUrl:
                unsafe.append(request.url)
                await route.abort("blockedbyclient")
                return
            except PlaywrightError:
                await route.abort("failed")
                return
            if final_url == request.url:
                await route.fulfill(response=response)
            else:
                # Every hop was checked. One redirect to the end keeps page.url correct.
                await route.fulfill(status=302, headers={"location": final_url})
        else:
            await route.continue_()

    await context.route("**/*", guard)


async def fetch_one(
    browser: Browser, url: str, script: str, policy: UrlPolicy, robots: RobotsCheck,
) -> FetchedPage:
    policy = cached_policy(policy)
    try:
        await policy(url)
    except UnsafeUrl as error:
        return FetchedPage(url, url, "unsafe", str(error))
    allowed, reason = await robots(url)
    if not allowed:
        return FetchedPage(url, url, "robots", reason)

    unsafe: list[str] = []
    context = await browser.new_context(
        viewport=VIEWPORT, user_agent=USER_AGENT, service_workers="block", accept_downloads=False,
    )
    context.set_default_timeout(config.PAGE_TIMEOUT_MS)
    checks: list[asyncio.Task] = []

    async def check_redirect(target: str) -> None:
        try:
            await policy(target)
        except UnsafeUrl:
            unsafe.append(target)

    try:
        await _guard_requests(context, policy, unsafe)
        page = await context.new_page()
        page.on("request", lambda request: checks.append(asyncio.create_task(check_redirect(request.url)))
                if request.redirected_from else None)
        try:
            response = await page.goto(url, wait_until="domcontentloaded", timeout=config.PAGE_TIMEOUT_MS)
        except PlaywrightTimeout:
            return FetchedPage(url, url, "failed", "Pagina nu s-a încărcat la timp.")
        except PlaywrightError:
            if unsafe:
                return FetchedPage(url, url, "unsafe", "Pagina redirecționează spre o adresă nepermisă.")
            return FetchedPage(url, url, "failed", "Pagina nu a putut fi deschisă.")
        if response is None:
            return FetchedPage(url, url, "failed", "Pagina nu a răspuns.")

        status = response.status
        if status in GONE_STATUSES:
            return FetchedPage(url, page.url, "unavailable", "Pagină indisponibilă.")
        if status in BLOCKED_STATUSES:
            return FetchedPage(url, page.url, "blocked", f"Site-ul a refuzat accesul ({status}).")

        try:
            await page.wait_for_load_state("networkidle", timeout=SETTLE_TIMEOUT_MS)
        except PlaywrightTimeout:
            pass  # Busy pages never go idle. What has loaded so far is still valid.

        raw = await page.evaluate(script)
        if raw.get("challenge"):
            return FetchedPage(url, page.url, "blocked", "Site-ul cere o verificare anti-robot.")
        shot = await page.screenshot(type="jpeg", quality=JPEG_QUALITY, full_page=False)
        if checks:
            await asyncio.gather(*checks)
        try:
            await policy(page.url)
        except UnsafeUrl:
            unsafe.append(page.url)
        if unsafe:
            return FetchedPage(url, page.url, "unsafe", "Pagina redirecționează spre o adresă nepermisă.")
        return FetchedPage(url, page.url, "ok", "", _capture(raw, status, shot))
    except (PlaywrightError, ValidationError):
        return FetchedPage(url, url, "failed", "Pagina nu a putut fi citită.")
    finally:
        await context.close()


async def fetch_pages(
    urls: list[str], policy: UrlPolicy = check_public_url, robots: RobotsCheck | None = None,
) -> list[FetchedPage]:
    robots = robots or (lambda url: robots_allowed(url, policy))
    script = config.EXTRACT_SCRIPT.read_text(encoding="utf-8")
    limit = asyncio.Semaphore(config.FETCH_CONCURRENCY)
    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True)
            try:
                async def bounded(url: str) -> FetchedPage:
                    async with limit:
                        return await fetch_one(browser, url, script, policy, robots)
                return list(await asyncio.gather(*(bounded(url) for url in urls)))
            finally:
                await browser.close()
    except PlaywrightError as error:
        if "Executable doesn't exist" in str(error):
            raise AnalysisError(
                "browser_missing",
                "Lipsește browserul. Rulează: python -m playwright install chromium-headless-shell",
            ) from error
        raise AnalysisError("browser_failed", "Browserul de analiză nu a pornit.") from error
