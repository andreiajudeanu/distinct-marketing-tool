"""Phases 4 and 5: verification, comparison, recommendations and the whole pipeline."""

import asyncio

import pytest

from app.analysis import EvidenceBook, compare, valid_claims, verify_competitors
from app.discovery import Candidate, SearchHit
from app.errors import AnalysisError
from app.fetcher import FetchedPage
from app.jobs import JobStore
from app.pipeline import Deps, run_pipeline
from app.recommendations import filter_recommendations, recommend
from app.schemas import (
    AnalysisRequest, BusinessProfile, Capabilities, Competitor, InferredText, LlmClaim, LlmComparison,
    LlmPositioning, LlmProfile, LlmQueries, LlmRecommendation, LlmRecommendations, LlmTriage,
    LlmTriagePick, LlmVerdict, LlmVerification, LlmVisual, MarketDetection, PageCapture, SiteContent,
)
from app.text import quote_in_text


def rival_page(domain="rival.ro", **extra):
    fields = dict(
        url=f"https://{domain}/", title=domain, headings=["Parfumuri nișă românești"],
        cta_texts=["Cumpără acum"], visible_text="Parfumuri nișă românești. Livrare în toată România.",
        screenshot_jpeg_base64="QUJD",
    )
    return PageCapture(**{**fields, **extra})


def candidate(domain="rival.ro"):
    return Candidate(domain, f"https://{domain}/p", f"https://{domain}/", domain, "s", [f"https://{domain}/p"])


def verdict(domain="rival.ro", **extra):
    fields = dict(
        domain=domain, name=domain, category="direct", why_relevant="Vinde același tip de produs.",
        quotes=["Parfumuri nișă românești"], market_status="confirmed",
        market_quote="Livrare în toată România", value_propositions=["Nișă"],
        product_categories=["Parfumuri"], pricing_position="Necitit",
    )
    return LlmVerdict(**{**fields, **extra})


def profile():
    text = InferredText(value="Parfumuri")
    return BusinessProfile(
        url="https://own.ro/", domain="own.ro", title="", meta_description="", business_name="Own",
        category=text, products=["Parfum"], value_proposition=text, target_audience=text, headings=[],
    )


MARKET = MarketDetection(country_code="RO", language="ro", status="detected", signals=[], note="")


def verify(verdicts, fetched=None, candidates=None, market=MARKET):
    async def fake_llm(**_):
        return LlmVerification(verdicts=verdicts)

    candidates = candidates or [candidate()]
    fetched = fetched or [FetchedPage("https://rival.ro/", "https://rival.ro/", "ok", "", rival_page())]
    book = EvidenceBook()
    result = asyncio.run(verify_competitors(fake_llm, profile(), market, candidates, fetched, book))
    return (*result, book)


def test_quote_check_accepts_real_excerpts_and_rejects_paraphrases():
    text = "Livrare gratuită   în toată România, în 48 de ore."
    assert quote_in_text("livrare gratuita în toată românia", text)
    assert not quote_in_text("Livrăm repede în România", text)
    assert not quote_in_text("48", text)


def test_a_verified_competitor_carries_real_evidence():
    competitors, skipped, _, book = verify([verdict()])
    assert [c.domain for c in competitors] == ["rival.ro"]
    assert competitors[0].market_status == "confirmed"
    assert competitors[0].screenshot_data_url == "data:image/jpeg;base64,QUJD"
    assert set(competitors[0].evidence_ids) <= book.ids()
    assert skipped == []


def test_a_competitor_supported_only_by_invented_quotes_is_dropped():
    competitors, skipped, _, book = verify([verdict(quotes=["Cel mai mare magazin din țară"])])
    assert competitors == []
    assert skipped[0].status == "unverified"
    assert not book.items


def test_a_market_claim_without_a_real_quote_stays_unconfirmed():
    competitors, *_ = verify([verdict(market_quote="Livrăm oriunde")])
    assert competitors[0].market_status == "unconfirmed"


def test_structured_shipping_confirms_the_market():
    page = rival_page(ships_to=["RO"])
    fetched = [FetchedPage("https://rival.ro/", "https://rival.ro/", "ok", "", page)]
    competitors, *_ = verify([verdict(market_quote="")], fetched)
    assert competitors[0].market_status == "confirmed"


def test_other_markets_and_non_competitors_are_excluded_with_a_reason():
    competitors, skipped, *_ = verify([verdict(market_status="other_market")])
    assert competitors == [] and skipped[0].status == "other_market"
    competitors, skipped, *_ = verify([verdict(category="not_competitor")])
    assert competitors == [] and skipped[0].status == "not_competitor"


def test_a_verdict_for_a_page_we_never_read_is_ignored():
    competitors, skipped, *_ = verify([verdict(domain="inventat.ro")])
    assert competitors == []
    assert skipped[0].domain == "rival.ro"


def test_blocked_pages_are_reported_and_never_counted():
    fetched = [FetchedPage("https://rival.ro/", "https://rival.ro/", "blocked", "Refuzat")]
    competitors, skipped, *_ = verify([], fetched)
    assert competitors == []
    assert (skipped[0].status, skipped[0].reason) == ("blocked", "Refuzat")


def test_a_page_redirecting_to_the_users_own_site_is_not_a_competitor():
    fetched = [FetchedPage("https://rival.ro/", "https://own.ro/", "ok", "", rival_page())]
    competitors, skipped, *_ = verify([verdict()], fetched)
    assert competitors == []
    assert skipped[0].status == "not_competitor"


def test_at_most_five_competitors_with_direct_ones_first():
    domains = [f"r{i}.ro" for i in range(7)]
    candidates = [candidate(domain) for domain in domains]
    fetched = [FetchedPage(f"https://{d}/", f"https://{d}/", "ok", "", rival_page(d)) for d in domains]
    verdicts = [verdict(d, category="indirect" if i < 2 else "direct") for i, d in enumerate(domains)]
    competitors, skipped, *_ = verify(verdicts, fetched, candidates)
    assert len(competitors) == 5
    assert [c.category for c in competitors] == ["direct"] * 5
    assert len(skipped) == 2


def test_claims_without_saved_evidence_are_dropped():
    claims = [LlmClaim(text="Bună", evidence_ids=["e1", "e99"]), LlmClaim(text="Rea", evidence_ids=["e99"])]
    kept = valid_claims(claims, {"e1"})
    assert [(claim.text, claim.evidence_ids) for claim in kept] == [("Bună", ["e1"])]


def competitor_model():
    empty = SiteContent(
        headlines=[], ctas=[], value_propositions=[], product_categories=[], pricing_position="Necitit",
        page_structure=[], palette=[], fonts=[],
    )
    return Competitor(
        name="R", url="https://rival.ro/", domain="rival.ro", category="direct", market_status="confirmed",
        why_relevant="", evidence_ids=[], source_urls=[], content=empty,
    )


def comparison(visual_ids, domain="rival.ro"):
    return LlmComparison(
        positioning_summary="s", own_value_propositions=[], own_product_categories=[], own_pricing_position="Necitit",
        positioning=[LlmPositioning(domain=domain, similarities=[LlmClaim(text="a", evidence_ids=["e1"])], differences=[])],
        visual=[LlmVisual(domain=domain, similarities=[LlmClaim(text="v", evidence_ids=visual_ids)], differences=[], layout="grid")],
    )


def run_compare(result):
    seen = {}

    async def fake_llm(*, system, content, output, effort="medium"):
        seen["content"] = content
        return result

    book = EvidenceBook()
    book.add("rival.ro", "https://rival.ro/", "text", "titlu", "Titlu")
    book.add("rival.ro", "https://rival.ro/", "screenshot", "captură", "Ecran")
    own = rival_page("own.ro")
    outcome = asyncio.run(compare(fake_llm, "own.ro", own, [competitor_model()], {"rival.ro": rival_page()}, book))
    return outcome, seen


def test_screenshots_reach_claude_as_images():
    _, seen = run_compare(comparison(["e2"]))
    assert sum(block["type"] == "image" for block in seen["content"]) == 2
    assert "<date_pagini>" in seen["content"][-1]["text"]


def test_a_visual_claim_must_cite_a_screenshot():
    (_, _, visual), _ = run_compare(comparison(["e1"]))
    assert visual[0].similarities == []
    (_, _, visual), _ = run_compare(comparison(["e2"]))
    assert len(visual[0].similarities) == 1


def test_a_comparison_for_an_unknown_site_is_ignored():
    (_, positioning, visual), _ = run_compare(comparison(["e2"], domain="inventat.ro"))
    assert positioning == [] and visual == []


def recommendation(**extra):
    fields = dict(
        priority="medium", problem="p", evidence_ids=["e1"], opportunity="o", website_change="w",
        example_headline="h", example_cta="c", expected_benefit_hypothesis="Ar putea ajuta.",
        assumptions=[], requires=[],
    )
    return LlmRecommendation(**{**fields, **extra})


def test_recommendations_without_saved_evidence_are_removed():
    kept = filter_recommendations(
        [recommendation(), recommendation(evidence_ids=["e99"])], {"e1"}, Capabilities(),
    )
    assert len(kept) == 1


def test_an_undeclared_capability_becomes_a_visible_assumption():
    kept = filter_recommendations([recommendation(requires=["samples"])], {"e1"}, Capabilities())
    assert kept[0].assumptions == ["Presupune că poți oferi mostre. Nu ai declarat asta."]
    kept = filter_recommendations([recommendation(requires=["samples"])], {"e1"}, Capabilities(samples=True))
    assert kept[0].assumptions == []


def test_recommendations_are_sorted_by_priority_and_capped_at_three():
    items = [recommendation(priority=p) for p in ("low", "high", "medium", "medium")]
    kept = filter_recommendations(items, {"e1"}, Capabilities())
    assert [item.priority for item in kept] == ["high", "medium", "medium"]


def test_recommend_retries_once_then_returns_the_real_number():
    calls = []

    async def fake_llm(**_):
        calls.append(1)
        return LlmRecommendations(recommendations=[recommendation()])

    book = EvidenceBook()
    book.add("a.ro", "https://a.ro/", "text", "titlu", "Titlu")
    result = asyncio.run(recommend(fake_llm, profile(), "s", book, Capabilities(), "ro"))
    assert len(result) == 1
    assert len(calls) == 2


class Script:
    """Answers each Llm* schema with a canned reply, or raises it."""

    def __init__(self, **replies):
        self.replies = {
            "LlmProfile": LlmProfile(
                business_name="Own", category="Parfumuri", products=["Parfum"], value_proposition="Nișă",
                value_proposition_basis="", target_audience="", target_audience_basis="",
                language_code="ro", country_code="RO", country_quote="Livrare în toată România",
            ),
            "LlmQueries": LlmQueries(queries=["parfumuri nișă"]),
            "LlmTriage": LlmTriage(selected=[LlmTriagePick(domain="rival.ro", reason="r")]),
            "LlmVerification": LlmVerification(verdicts=[verdict()]),
            "LlmComparison": comparison(["e1"]),
            "LlmRecommendations": LlmRecommendations(recommendations=[recommendation() for _ in range(3)]),
            **replies,
        }

    async def __call__(self, *, system, content, output, effort="medium"):
        reply = self.replies[output.__name__]
        if isinstance(reply, Exception):
            raise reply
        return reply


def deps(llm=None, hits=None, fetched=None):
    hits = [SearchHit("https://rival.ro/p", "Rival", "s")] if hits is None else hits

    async def search(query, country):
        return hits

    async def fetch(urls):
        return fetched if fetched is not None else [
            FetchedPage(url, url, "ok", "", rival_page()) for url in urls
        ]

    return Deps(llm=llm or Script(), search=search, fetch=fetch)


def run_job(page, dependencies):
    store = JobStore()
    job = store.create(AnalysisRequest(page=page), page, "LIVE")
    asyncio.run(run_pipeline(store, job, dependencies))
    return store.view(job, include_screenshots=True)


def states(view):
    return {step.id: step.state for step in view.steps}


def test_the_whole_pipeline_finishes_with_cited_recommendations(page):
    view = run_job(page, deps())
    assert view.status == "done", view.errors
    assert set(states(view).values()) == {"done"}
    assert view.result.market.status == "detected"
    assert [c.domain for c in view.result.competitors] == ["rival.ro"]
    assert len(view.result.recommendations) == 3
    assert any("doar 1 competitori" in warning for warning in view.warnings)
    ids = {item.id for item in view.result.evidence}
    assert all(set(r.evidence_ids) <= ids for r in view.result.recommendations)


def test_the_backend_takes_the_own_screenshot_when_chrome_could_not(page):
    asked = []
    dependencies = deps()
    real_fetch = dependencies.fetch

    async def fetch(urls):
        asked.extend(urls)
        return await real_fetch(urls)

    dependencies.fetch = fetch
    view = run_job(page, dependencies)
    assert page.url in asked
    assert view.result.own_screenshot_data_url == "data:image/jpeg;base64,QUJD"
    assert page.url not in {item.url for item in view.result.skipped}


def test_an_own_screenshot_from_the_extension_is_not_fetched_again(page):
    asked = []
    dependencies = deps()
    real_fetch = dependencies.fetch

    async def fetch(urls):
        asked.extend(urls)
        return await real_fetch(urls)

    dependencies.fetch = fetch
    run_job(page.model_copy(update={"screenshot_jpeg_base64": "T1dO"}), dependencies)
    assert page.url not in asked


def test_a_missing_own_screenshot_is_reported_not_hidden(page):
    fetched = [FetchedPage("https://rival.ro/", "https://rival.ro/", "ok", "", rival_page())]
    view = run_job(page, deps(fetched=fetched))
    assert view.result.own_screenshot_data_url is None
    assert any("captura site-ului tău" in warning for warning in view.warnings)


def test_research_failure_produces_no_competitors_and_keeps_the_profile(page):
    async def search(query, country):
        raise AnalysisError("search_auth", "Cheia Tavily din .env nu e acceptată.")

    dependencies = deps()
    dependencies.search = search
    view = run_job(page, dependencies)
    assert view.status == "partial"
    assert view.errors[0].stage == "discovery"
    assert view.result.profile and view.result.market
    assert view.result.competitors == []
    assert states(view)["discovery"] == "failed"
    assert states(view)["recommendations"] == "skipped"


def test_no_search_results_is_reported_not_filled_in(page):
    view = run_job(page, deps(hits=[]))
    assert view.errors[0].code == "no_candidates"
    assert view.result.competitors == []


def test_all_pages_blocked_means_zero_competitors(page):
    fetched = [FetchedPage("https://rival.ro/", "https://rival.ro/", "blocked", "Refuzat")]
    view = run_job(page, deps(fetched=fetched))
    assert view.errors[0].code == "no_competitors"
    assert view.result.skipped[0].status == "blocked"
    assert view.result.recommendations == []


def test_a_comparison_failure_keeps_verified_competitors(page):
    llm = Script(LlmComparison=AnalysisError("ai_status", "Claude a întors eroarea 500."))
    view = run_job(page, deps(llm=llm))
    assert view.status == "partial"
    assert len(view.result.competitors) == 1
    assert states(view)["comparison"] == "failed"


def test_a_profile_failure_fails_the_job(page):
    llm = Script(LlmProfile=AnalysisError("ai_auth", "Cheia Anthropic din .env nu e acceptată."))
    view = run_job(page, deps(llm=llm))
    assert view.status == "failed"
    assert view.errors[0].code == "ai_auth"


def test_an_unexpected_error_hides_its_details(page):
    llm = Script(LlmQueries=RuntimeError("secret token sk-ant-xyz"))
    view = run_job(page, deps(llm=llm))
    assert view.errors[0].code == "internal"
    assert "sk-ant" not in view.errors[0].message
