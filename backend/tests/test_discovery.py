"""Search, filtering and triage. Tavily is faked at the HTTP layer."""

import asyncio
import json

import httpx
import pytest

from app import discovery
from app.discovery import (
    Candidate, SearchHit, filter_hits, homepage_of, search_all, tavily_search, triage, usable_queries,
)
from app.errors import AnalysisError
from app.schemas import BusinessProfile, InferredText, LlmTriage, LlmTriagePick


def hit(url, title="Magazin", snippet="Vindem parfumuri"):
    return SearchHit(url, title, snippet)


def profile():
    text = InferredText(value="Parfumuri")
    return BusinessProfile(
        url="https://own.ro/", domain="own.ro", business_name="Own",
        category=text, value_proposition=text, target_audience=text,
    )


def fake_tavily(monkeypatch, handler):
    real_client = httpx.AsyncClient

    def client(**kwargs):
        return real_client(transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(discovery.httpx, "AsyncClient", client)


def test_filter_removes_own_domain_marketplaces_directories_and_duplicates():
    kept = filter_hits([
        hit("https://shop.own.ro/x"),
        hit("https://www.emag.ro/parfum"),
        hit("https://www.amazon.de/parfum"),
        hit("https://ro.wikipedia.org/wiki/Parfum"),
        hit("https://www.facebook.com/brand"),
        hit("https://rival.ro/parfumuri"),
        hit("https://www.rival.ro/altceva"),
        hit("javascript:alert(1)"),
        hit("https://rival2.co.uk/"),
    ], "https://own.ro/")
    assert [item.domain for item in kept] == ["rival.ro", "rival2.co.uk"]
    assert kept[0].source_urls == ["https://rival.ro/parfumuri", "https://www.rival.ro/altceva"]


def test_filter_drops_listicle_articles_but_keeps_homepages():
    kept = filter_hits([
        hit("https://blog.ro/top-10-parfumuri", title="Top 10 parfumuri"),
        hit("https://top-parfum.ro/", title="Top Parfum"),
    ], "https://own.ro/")
    assert [item.domain for item in kept] == ["top-parfum.ro"]


def test_filter_caps_candidates_at_fifteen():
    hits = [hit(f"https://rival{i}.ro/") for i in range(30)]
    assert len(filter_hits(hits, "https://own.ro/")) == 15


@pytest.mark.parametrize("url, expected", [
    ("https://a.ro/parfumuri/oud", "https://a.ro/"),
    ("https://a.com/ro/parfumuri", "https://a.com/ro/"),
    ("https://a.com/en-gb/", "https://a.com/en-gb/"),
])
def test_homepage_keeps_a_locale_prefix(url, expected):
    assert homepage_of(url) == expected


def test_at_most_three_queries_and_empty_ones_are_refused():
    assert usable_queries(["a", " ", "b", "c", "d"]) == ["a", "b", "c"]
    with pytest.raises(AnalysisError):
        usable_queries(["", " "])


def test_triage_cannot_add_a_domain_search_did_not_return():
    candidates = [Candidate("rival.ro", "https://rival.ro/p", "https://rival.ro/", "R", "s", [])]

    async def fake_llm(**_):
        return LlmTriage(selected=[
            LlmTriagePick(domain="invented.ro", reason="x"),
            LlmTriagePick(domain="www.rival.ro", reason="y"),
            LlmTriagePick(domain="rival.ro", reason="duplicate"),
        ])

    assert asyncio.run(triage(fake_llm, profile(), candidates)) == candidates


def test_tavily_request_uses_bearer_auth_and_boosts_the_market(monkeypatch):
    seen = {}

    def handler(request):
        seen["auth"] = request.headers["authorization"]
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"results": [
            {"url": "https://a.ro/", "title": "A", "content": "c", "score": 0.9},
        ]})

    fake_tavily(monkeypatch, handler)
    hits = asyncio.run(tavily_search("parfum", "RO"))
    assert seen["auth"] == "Bearer test-key"
    assert seen["body"]["country"] == "romania"
    assert seen["body"]["search_depth"] == "basic"
    assert seen["body"]["max_results"] == 5
    assert hits == [SearchHit("https://a.ro/", "A", "c")]


def test_tavily_omits_a_country_it_would_reject(monkeypatch):
    seen = {}

    def handler(request):
        seen.update(json.loads(request.content))
        return httpx.Response(200, json={"results": []})

    fake_tavily(monkeypatch, handler)
    asyncio.run(tavily_search("parfum", ""))
    assert "country" not in seen


@pytest.mark.parametrize("status, code", [(401, "search_auth"), (432, "search_quota"), (500, "search_status")])
def test_tavily_failures_are_reported_never_replaced(monkeypatch, status, code):
    fake_tavily(monkeypatch, lambda request: httpx.Response(status, json={}))
    with pytest.raises(AnalysisError) as caught:
        asyncio.run(tavily_search("parfum", "RO"))
    assert caught.value.code == code


def test_tavily_retries_once_after_rate_limiting(monkeypatch):
    replies = [httpx.Response(429, headers={"retry-after": "0"}), httpx.Response(200, json={"results": []})]
    fake_tavily(monkeypatch, lambda request: replies.pop(0))
    assert asyncio.run(tavily_search("parfum", "RO")) == []
    assert not replies


def test_one_failed_query_becomes_a_warning():
    async def search(query, country):
        if query == "rea":
            raise AnalysisError("search_status", "Tavily returned error 500.")
        return [hit("https://a.ro/")]

    hits, warnings = asyncio.run(search_all(search, ["bună", "rea"], "RO"))
    assert len(hits) == 1
    assert len(warnings) == 1


def test_all_queries_failing_raises_instead_of_returning_nothing():
    async def search(query, country):
        raise AnalysisError("search_auth", "The Tavily key in .env was not accepted.")

    with pytest.raises(AnalysisError):
        asyncio.run(search_all(search, ["a", "b"], "RO"))
