"""Phase 4: real Chromium against local servers.

The default policy refuses localhost, so these tests pass a policy that treats one
local server as public and a second one as forbidden.
"""

import asyncio
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from app.fetcher import fetch_pages, robots_allowed
from app.url_safety import UnsafeUrl

PAGE = """<!doctype html><html lang="ro"><head><title>Rival</title>
<meta name="description" content="Parfumuri nișă pentru cunoscători.">
<meta property="og:locale" content="ro_RO">
<link rel="alternate" hreflang="ro-RO" href="/">
<script type="application/ld+json">{"@type":"Product","offers":{"priceCurrency":"RON",
"shippingDetails":{"shippingDestination":{"addressCountry":"RO"}}}}</script>
</head><body style="background:#112233;color:#ffffff"><header><nav><a href="/a">Parfumuri</a></nav></header>
<main><h1>Parfumuri nișă</h1><h2>Livrare în România</h2><p>De la 329 lei.</p>
<button>Adaugă în coș</button><a class="btn" href="/c">Vezi colecția</a></main></body></html>"""


class Forbidden(BaseHTTPRequestHandler):
    hits: list[str] = []

    def do_GET(self):
        type(self).hits.append(self.path)
        self.send_response(200)
        self.send_header("content-type", "text/html")
        self.end_headers()
        self.wfile.write(b"<h1>secret intern</h1>")

    def log_message(self, *args):
        pass


def make_site(forbidden_origin):
    class Site(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/redirect-out":
                return self._redirect(f"{forbidden_origin}/secret")
            if self.path == "/redirect-chain":
                return self._redirect("/redirect-out")
            if self.path == "/redirect-in":
                return self._redirect("/ok")
            if self.path == "/gone":
                return self._html(404, "<h1>Nu există</h1>")
            if self.path == "/refused":
                return self._html(403, "<h1>Interzis</h1>")
            if self.path == "/captcha":
                return self._html(200, "<title>Just a moment...</title><p>Verify you are human</p>")
            if self.path == "/robots.txt":
                return self._text("User-agent: *\nDisallow: /private\n")
            return self._html(200, PAGE)

        def _redirect(self, target):
            self.send_response(302)
            self.send_header("location", target)
            self.end_headers()

        def _html(self, status, body):
            data = body.encode("utf-8")
            self.send_response(status)
            self.send_header("content-type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(data)

        def _text(self, body):
            self.send_response(200)
            self.send_header("content-type", "text/plain")
            self.end_headers()
            self.wfile.write(body.encode())

        def log_message(self, *args):
            pass

    return Site


def serve(handler):
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


@pytest.fixture
def sites():
    Forbidden.hits = []
    forbidden = serve(Forbidden)
    forbidden_origin = f"http://127.0.0.1:{forbidden.server_address[1]}"
    site = serve(make_site(forbidden_origin))
    origin = f"http://127.0.0.1:{site.server_address[1]}"

    async def policy(url):
        if url.startswith(forbidden_origin):
            raise UnsafeUrl("Adresa duce într-o rețea privată.")

    async def allow_all(url):
        return True, ""

    yield origin, forbidden_origin, policy, allow_all
    site.shutdown()
    forbidden.shutdown()


def fetch(url, policy, robots):
    return asyncio.run(fetch_pages([url], policy=policy, robots=robots))[0]


def test_a_public_page_yields_text_design_signals_and_a_screenshot(sites):
    origin, _, policy, robots = sites
    result = fetch(f"{origin}/ok", policy, robots)
    assert result.status == "ok", result.reason
    page = result.page
    assert page.title == "Rival"
    assert page.meta_description == "Parfumuri nișă pentru cunoscători."
    assert "Parfumuri nișă" in page.headings
    assert "Adaugă în coș" in page.cta_texts
    assert "Vezi colecția" in page.cta_texts
    assert "#112233" in page.colors
    assert page.currency == "RON"
    assert page.ships_to == ["RO"]
    assert page.og_locale == "ro_RO"
    assert page.hreflang == ["ro-RO"]
    assert page.prices == ["329 lei"]
    assert page.screenshot_jpeg_base64.startswith("/9j/")


def test_a_redirect_to_a_forbidden_address_never_reaches_it(sites):
    origin, _, policy, robots = sites
    result = fetch(f"{origin}/redirect-out", policy, robots)
    assert result.status == "unsafe"
    assert result.page is None
    assert Forbidden.hits == []


def test_a_safe_hop_cannot_hide_a_forbidden_one_later_in_the_chain(sites):
    origin, _, policy, robots = sites
    result = fetch(f"{origin}/redirect-chain", policy, robots)
    assert result.status == "unsafe"
    assert Forbidden.hits == []


def test_a_redirect_inside_the_site_is_followed(sites):
    origin, _, policy, robots = sites
    result = fetch(f"{origin}/redirect-in", policy, robots)
    assert result.status == "ok", result.reason
    assert result.final_url.endswith("/ok")


def test_a_forbidden_start_address_opens_nothing(sites):
    _, forbidden_origin, policy, robots = sites
    assert fetch(f"{forbidden_origin}/secret", policy, robots).status == "unsafe"
    assert Forbidden.hits == []


def test_a_missing_page_is_unavailable_not_retired(sites):
    origin, _, policy, robots = sites
    result = fetch(f"{origin}/gone", policy, robots)
    assert (result.status, result.reason) == ("unavailable", "Pagină indisponibilă.")


def test_refusal_and_challenge_pages_are_blocked_without_a_workaround(sites):
    origin, _, policy, robots = sites
    assert fetch(f"{origin}/refused", policy, robots).status == "blocked"
    assert fetch(f"{origin}/captcha", policy, robots).status == "blocked"


def test_robots_txt_is_respected(sites):
    origin, _, policy, _ = sites
    assert asyncio.run(robots_allowed(f"{origin}/ok", policy))[0] is True
    allowed, reason = asyncio.run(robots_allowed(f"{origin}/private/x", policy))
    assert allowed is False
    assert "robots.txt" in reason
    result = asyncio.run(fetch_pages([f"{origin}/private/x"], policy=policy))[0]
    assert result.status == "robots"
