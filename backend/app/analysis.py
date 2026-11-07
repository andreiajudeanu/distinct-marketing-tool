"""One report call: verifies competitors, compares them and writes recommendations.

Claude proposes and the code decides. A quote must exist on the fetched page, and
a claim must cite evidence that was really saved, or it is dropped.
"""

import json
import re
from dataclasses import dataclass, field

from . import config
from .discovery import Candidate
from .fetcher import FetchedPage
from .jobs import now_iso
from .llm import LlmFn, image_block
from .market import country_code
from .profile import page_digest
from .recommendations import filter_recommendations
from .schemas import (
    BusinessProfile, Capabilities, Claim, Competitor, Evidence, LlmClaim, LlmReport, LlmVerdict,
    MarketDetection, PageCapture, Recommendation, SkippedSite,
)
from .text import quote_in_text, registrable_domain

MAX_FIELD_EVIDENCE = 2
MAX_QUOTES = 2
CATEGORY_ORDER = {"direct": 0, "indirect": 1, "visual_reference": 2}
SCREENSHOT_NOTE = "First screen of the page, saved during the analysis."

SYSTEM = """You compare a business with possible competitors and write a short report in English.
Be brief. Every text field is one short sentence, unless stated otherwise.

Return one verdict for every site in the list, with its exact domain.
category: direct (same products, same customers), indirect (same need, solved differently),
visual_reference (not a commercial competitor, useful as style), not_competitor.
quotes: 1-2 fragments copied exactly from that site's page that support the category.
market_status: confirmed only if the page shows commercial presence in the target country,
and market_quote is the exact fragment. other_market if the page shows another market.
unconfirmed if the page does not say. A site's language or domain does not show where it sells.
positioning: how its message differs from the business, citing evidence ids.
visual: what looks different in the screenshots, citing that site's screenshot evidence id.
If a site has no screenshot, leave visual empty with no ids.

gap_summary: 2-3 sentences on the main differentiation opportunity, citing evidence ids.

recommendations: exactly 3, highest priority first, each citing evidence ids.
example_headline and example_cta are in the language of the business's website. Leave them empty if they do not apply.
Do not invent capabilities, customer benefits, figures or facts about the business.
If a recommendation depends on unverified information, put it in assumptions.
requires lists what the store must be able to offer, from: samples, bundles, freeShipping.
expected_benefit_hypothesis is a conditional hypothesis to test, never a promised result.

What a competitor does is a signal to investigate. Never say or imply that its sales grew.
Do not use scores or percentages. Evidence ids go only in the evidence_ids fields, never inside the text."""

INLINE_CITATION = re.compile(r"\s*\(?\be\d+(?:\s*,\s*e\d+)*\)?(?=[\s.,;:]|$)")


class EvidenceBook:
    def __init__(self) -> None:
        self.items: list[Evidence] = []

    def add(self, domain: str, url: str, kind: str, field_name: str, quote: str) -> str:
        evidence_id = f"e{len(self.items) + 1}"
        self.items.append(Evidence(
            id=evidence_id, domain=domain, url=url, kind=kind, field=field_name,
            quote=quote[:300], captured_at=now_iso(),
        ))
        return evidence_id

    def add_site(self, domain: str, page: PageCapture) -> None:
        if page.meta_description:
            self.add(domain, page.url, "text", "description", page.meta_description)
        for heading in page.headings[:MAX_FIELD_EVIDENCE]:
            self.add(domain, page.url, "text", "headline", heading)
        for cta in page.cta_texts[:MAX_FIELD_EVIDENCE]:
            self.add(domain, page.url, "text", "button", cta)
        if page.screenshot_jpeg_base64:
            self.add(domain, page.url, "screenshot", "screenshot", SCREENSHOT_NOTE)

    def ids(self, domains: set[str] | None = None) -> set[str]:
        return {item.id for item in self.items if domains is None or item.domain in domains}

    def screenshot_ids(self) -> set[str]:
        return {item.id for item in self.items if item.kind == "screenshot"}

    def screenshot_of(self, domain: str) -> str | None:
        return next((item.id for item in self.items if item.domain == domain and item.kind == "screenshot"), None)

    def keep_only(self, domains: set[str]) -> None:
        self.items = [item for item in self.items if item.domain in domains]


@dataclass
class Report:
    competitors: list[Competitor] = field(default_factory=list)
    skipped: list[SkippedSite] = field(default_factory=list)
    gap_summary: Claim | None = None
    recommendations: list[Recommendation] = field(default_factory=list)
    evidence: list[Evidence] = field(default_factory=list)


def page_text(page: PageCapture) -> str:
    return " ".join([page.title, page.meta_description, *page.headings, *page.cta_texts, page.visible_text])


def data_url(page: PageCapture) -> str | None:
    return f"data:image/jpeg;base64,{page.screenshot_jpeg_base64}" if page.screenshot_jpeg_base64 else None


def clean_text(text: str) -> str:
    return INLINE_CITATION.sub("", text).strip()


def valid_claim(claim: LlmClaim, allowed: set[str]) -> Claim | None:
    ids = [evidence_id for evidence_id in claim.evidence_ids if evidence_id in allowed]
    text = clean_text(claim.text)
    return Claim(text=text, evidence_ids=ids) if ids and text else None


def split_pages(
    profile: BusinessProfile, candidates: list[Candidate], fetched: list[FetchedPage],
) -> tuple[dict[str, tuple[Candidate, PageCapture]], list[SkippedSite]]:
    own = registrable_domain(profile.url)
    by_url = {candidate.homepage: candidate for candidate in candidates}
    pages: dict[str, tuple[Candidate, PageCapture]] = {}
    skipped: list[SkippedSite] = []
    for item in fetched:
        candidate = by_url.get(item.url)
        domain = candidate.domain if candidate else registrable_domain(item.url)
        if item.status != "ok" or item.page is None or candidate is None:
            skipped.append(SkippedSite(domain=domain, url=item.url, status=item.status, reason=item.reason))
        elif registrable_domain(item.final_url) == own:
            skipped.append(SkippedSite(domain=domain, url=item.url, status="not_competitor",
                                       reason="This page leads to your own site."))
        else:
            pages[domain] = (candidate, item.page)
    return pages, skipped


def build_prompt(
    profile: BusinessProfile,
    market: MarketDetection,
    own_domain: str,
    own_page: PageCapture,
    pages: dict[str, tuple[Candidate, PageCapture]],
    capabilities: Capabilities,
    book: EvidenceBook,
) -> list[dict]:
    content: list[dict] = []
    shots = [(own_domain, own_page), *((domain, page) for domain, (_, page) in pages.items())]
    for domain, page in shots:
        if page.screenshot_jpeg_base64:
            content.append({"type": "text", "text": f"Screenshot of {domain}, evidence {book.screenshot_of(domain)}:"})
            content.append(image_block(page.screenshot_jpeg_base64))
    brief = {
        "business": profile.business_name,
        "domain": own_domain,
        "category": profile.category.value,
        "value_proposition": profile.value_proposition.value,
        "audience": profile.target_audience.value,
        "target_country": market.country_code or "unknown",
        "site_language": market.language or "unknown",
        "declared_capabilities": capabilities.model_dump(),
    }
    sites = {
        own_domain: page_digest(own_page),
        **{domain: page_digest(page) for domain, (_, page) in pages.items()},
    }
    evidence = [item.model_dump(include={"id", "domain", "kind", "field", "quote"}) for item in book.items]
    content.append({
        "type": "text",
        "text": f"Business: {json.dumps(brief, ensure_ascii=False)}\n\n<page_data>\n"
                f"Sites: {json.dumps(sites, ensure_ascii=False)}\n"
                f"Evidence: {json.dumps(evidence, ensure_ascii=False)}\n</page_data>",
    })
    return content


def accept_verdict(
    verdict: LlmVerdict | None,
    domain: str,
    candidate: Candidate,
    page: PageCapture,
    market: MarketDetection,
    book: EvidenceBook,
) -> Competitor | SkippedSite:
    if verdict is None or verdict.category == "not_competitor":
        reason = verdict.why_relevant if verdict else "We could not verify its relevance."
        return SkippedSite(domain=domain, url=page.url, status="not_competitor", reason=reason)
    if verdict.market_status == "other_market" and verdict.category != "visual_reference":
        return SkippedSite(domain=domain, url=page.url, status="other_market", reason=verdict.why_relevant)

    text = page_text(page)
    quotes = [quote for quote in verdict.quotes if quote_in_text(quote, text)]
    if not quotes:
        return SkippedSite(domain=domain, url=page.url, status="unverified",
                           reason="The reasons given do not appear on the page we read.")

    confirmed = market.status != "unknown" and (
        quote_in_text(verdict.market_quote, text)
        or market.country_code in {country_code(value) for value in page.ships_to}
    )
    return Competitor(
        name=verdict.name or domain,
        url=page.url,
        domain=domain,
        category=verdict.category,
        market_status="confirmed" if confirmed else "unconfirmed",
        why_relevant=verdict.why_relevant,
        evidence_ids=[book.add(domain, page.url, "text", "quote", quote) for quote in quotes[:MAX_QUOTES]],
        source_urls=candidate.source_urls[:3],
        screenshot_data_url=data_url(page),
    )


async def build_report(
    llm: LlmFn,
    profile: BusinessProfile,
    market: MarketDetection,
    own_page: PageCapture,
    candidates: list[Candidate],
    fetched: list[FetchedPage],
    capabilities: Capabilities,
) -> Report:
    pages, skipped = split_pages(profile, candidates, fetched)
    if not pages:
        return Report(skipped=skipped)

    own_domain = registrable_domain(profile.url)
    book = EvidenceBook()
    book.add_site(own_domain, own_page)
    for domain, (_, page) in pages.items():
        book.add_site(domain, page)

    content = build_prompt(profile, market, own_domain, own_page, pages, capabilities, book)
    result = await llm(system=SYSTEM, content=content, output=LlmReport)

    verdicts: dict[str, LlmVerdict] = {}
    for verdict in result.verdicts:
        domain = registrable_domain(verdict.domain)
        if domain in pages:
            verdicts.setdefault(domain, verdict)

    accepted: list[Competitor] = []
    for domain, (candidate, page) in pages.items():
        outcome = accept_verdict(verdicts.get(domain), domain, candidate, page, market, book)
        (accepted if isinstance(outcome, Competitor) else skipped).append(outcome)

    accepted.sort(key=lambda item: (CATEGORY_ORDER[item.category], item.market_status != "confirmed"))
    chosen = accepted[: config.MAX_COMPETITORS]
    for competitor in accepted[config.MAX_COMPETITORS:]:
        skipped.append(SkippedSite(domain=competitor.domain, url=competitor.url, status="unverified",
                                   reason="Beyond the limit of 3 competitors."))

    domains = {own_domain, *(competitor.domain for competitor in chosen)}
    allowed = book.ids(domains)
    shots = book.screenshot_ids()
    for competitor in chosen:
        verdict = verdicts[competitor.domain]
        competitor.positioning = valid_claim(verdict.positioning, allowed)
        competitor.visual = valid_claim(verdict.visual, allowed & shots)

    book.keep_only(domains)
    return Report(
        competitors=chosen,
        skipped=skipped,
        gap_summary=valid_claim(result.gap_summary, allowed),
        recommendations=filter_recommendations(result.recommendations, allowed, capabilities),
        evidence=list(book.items),
    )
