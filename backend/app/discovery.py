"""Finds candidate competitors with Tavily, then filters them in code and with Claude."""

import asyncio
import json
import re
from dataclasses import dataclass, field
from typing import Awaitable, Callable
from urllib.parse import urlsplit

import httpx

from . import config
from .errors import AnalysisError
from .llm import LlmFn
from .schemas import BusinessProfile, LlmTriage
from .text import hostname, registrable_domain

TAVILY_URL = "https://api.tavily.com/search"
TAVILY_TIMEOUT_SECONDS = 30
MAX_EXCLUDED_DOMAINS = 150

MARKETPLACES = (
    "emag.ro", "amazon.", "ebay.", "etsy.com", "aliexpress.", "temu.com",
    "okazii.ro", "allegro.", "trendyol.", "walmart.com",
)
DIRECTORIES = (
    "wikipedia.org", "facebook.com", "instagram.com", "linkedin.com", "youtube.com", "tiktok.com",
    "pinterest.", "x.com", "twitter.com", "reddit.com", "quora.com", "medium.com", "yelp.",
    "tripadvisor.", "trustpilot.com", "g2.com", "capterra.", "crunchbase.com", "clutch.co",
    "yellowpages.", "paginiaurii.ro", "listafirme.ro", "glassdoor.", "forbes.", "github.com",
)
EXCLUDED_DOMAINS = [
    "emag.ro", "amazon.com", "ebay.com", "etsy.com", "aliexpress.com", "temu.com", "okazii.ro",
    "wikipedia.org", "facebook.com", "instagram.com", "linkedin.com", "youtube.com", "tiktok.com",
    "pinterest.com", "reddit.com", "quora.com", "medium.com", "trustpilot.com", "g2.com",
]
LISTICLE = re.compile(r"\b(top|best|cele mai bune|\d+\s+(best|top))\b", re.IGNORECASE)

# Tavily takes lowercase country names. It only boosts them, so a result from
# this search is never proof that a company sells in that country.
TAVILY_COUNTRIES = {
    "RO": "romania", "MD": "moldova", "BG": "bulgaria", "HU": "hungary", "PL": "poland",
    "DE": "germany", "AT": "austria", "CH": "switzerland", "FR": "france", "IT": "italy",
    "ES": "spain", "PT": "portugal", "NL": "netherlands", "BE": "belgium", "GB": "united kingdom",
    "IE": "ireland", "SE": "sweden", "NO": "norway", "DK": "denmark", "FI": "finland",
    "CZ": "czech republic", "SK": "slovakia", "GR": "greece", "TR": "turkey", "US": "united states",
    "CA": "canada", "AU": "australia", "NZ": "new zealand", "JP": "japan", "IN": "india", "BR": "brazil",
    "MX": "mexico",
}


@dataclass
class SearchHit:
    url: str
    title: str
    snippet: str


@dataclass
class Candidate:
    domain: str
    url: str
    homepage: str
    title: str
    snippet: str
    source_urls: list[str] = field(default_factory=list)


SearchFn = Callable[[str, str], Awaitable[list[SearchHit]]]

TRIAGE_SYSTEM = """From web search results, choose the sites that look like real competitors of the business.
A competitor sells similar products or services to similar customers.
Exclude directories, magazines, blogs, comparison articles and unrelated sites.
A site's language or domain does not show where it sells.
Choose at most 5 domains, most relevant first. Use the exact domains from the list. If none fit, return an empty list."""


async def tavily_search(query: str, country: str) -> list[SearchHit]:
    body: dict = {
        "query": query,
        "search_depth": "basic",
        "max_results": config.RESULTS_PER_QUERY,
        "topic": "general",
        "exclude_domains": EXCLUDED_DOMAINS[:MAX_EXCLUDED_DOMAINS],
    }
    if country in TAVILY_COUNTRIES:
        body["country"] = TAVILY_COUNTRIES[country]
    headers = {"authorization": f"Bearer {config.tavily_key()}"}
    async with httpx.AsyncClient(timeout=TAVILY_TIMEOUT_SECONDS) as client:
        try:
            response = await client.post(TAVILY_URL, json=body, headers=headers)
            if response.status_code == 429:
                delay = response.headers.get("retry-after", "")
                await asyncio.sleep(min(int(delay), 10) if delay.isdigit() else 2)
                response = await client.post(TAVILY_URL, json=body, headers=headers)
        except httpx.HTTPError as error:
            raise AnalysisError("search_unreachable", "Tavily is not responding.") from error
    if response.status_code == 401:
        raise AnalysisError("search_auth", "The Tavily key in .env was not accepted.")
    if response.status_code in (432, 433):
        raise AnalysisError("search_quota", "You reached your Tavily plan limit.")
    if response.status_code != 200:
        raise AnalysisError("search_status", f"Tavily returned error {response.status_code}.")
    return [
        SearchHit(item.get("url", ""), item.get("title", ""), item.get("content", ""))
        for item in response.json().get("results", [])
    ]


def _matches(domain: str, patterns: tuple[str, ...]) -> bool:
    return any(pattern in domain if pattern.endswith(".") else domain == pattern or domain.endswith(f".{pattern}")
               for pattern in patterns)


def homepage_of(url: str) -> str:
    parts = urlsplit(url)
    locale = re.match(r"^/[a-z]{2}(?:-[a-zA-Z]{2})?/", parts.path + "/")
    return f"{parts.scheme}://{parts.netloc}{locale.group(0) if locale else '/'}"


def filter_hits(hits: list[SearchHit], own_url: str) -> list[Candidate]:
    own = registrable_domain(own_url)
    by_domain: dict[str, Candidate] = {}
    for hit in hits:
        if not hit.url.startswith(("http://", "https://")):
            continue
        domain = registrable_domain(hit.url)
        if not domain or domain == own or _matches(domain, MARKETPLACES) or _matches(domain, DIRECTORIES):
            continue
        known = by_domain.get(domain)
        if known:
            known.source_urls.append(hit.url)
            continue
        if LISTICLE.search(hit.title) and urlsplit(hit.url).path.strip("/"):
            continue
        by_domain[domain] = Candidate(domain, hit.url, homepage_of(hit.url), hit.title, hit.snippet[:240], [hit.url])
    return list(by_domain.values())[: config.MAX_CANDIDATES]


def usable_queries(queries: list[str]) -> list[str]:
    cleaned = [query.strip() for query in queries if query.strip()]
    if not cleaned:
        raise AnalysisError("no_queries", "We could not write searches for this site.")
    return cleaned[: config.MAX_QUERIES]


async def search_all(search: SearchFn, queries: list[str], country: str) -> tuple[list[SearchHit], list[str]]:
    outcomes = await asyncio.gather(*(search(query, country) for query in queries), return_exceptions=True)
    hits = [hit for outcome in outcomes if isinstance(outcome, list) for hit in outcome]
    failures = [outcome for outcome in outcomes if isinstance(outcome, AnalysisError)]
    crashes = [outcome for outcome in outcomes if isinstance(outcome, Exception) and not isinstance(outcome, AnalysisError)]
    if crashes:
        raise crashes[0]
    if failures and not hits:
        raise failures[0]
    warnings = [f"One of {len(queries)} searches failed: {failure.message}" for failure in failures[:1]]
    return hits, warnings


async def triage(llm: LlmFn, profile: BusinessProfile, candidates: list[Candidate]) -> list[Candidate]:
    listing = [{"domain": item.domain, "title": item.title, "snippet": item.snippet} for item in candidates]
    brief = {"category": profile.category.value, "audience": profile.target_audience.value}
    result = await llm(
        system=TRIAGE_SYSTEM,
        content=[{
            "type": "text",
            "text": f"Business: {json.dumps(brief, ensure_ascii=False)}\n\n"
                    f"<page_data>\n{json.dumps(listing, ensure_ascii=False)}\n</page_data>",
        }],
        output=LlmTriage,
    )
    by_domain = {item.domain: item for item in candidates}
    picked: list[Candidate] = []
    for choice in result.selected:
        domain = registrable_domain(hostname(choice.domain) if "//" in choice.domain else choice.domain)
        candidate = by_domain.get(domain)
        if candidate and candidate not in picked:
            picked.append(candidate)
    return picked[: config.MAX_PAGES_TO_FETCH]
