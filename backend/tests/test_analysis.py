"""The report call, recommendations, cost tracking and the whole pipeline."""

import asyncio

from app import config
from app.analysis import EvidenceBook, build_report, valid_claim
from app.discovery import Candidate, SearchHit
from app.errors import AnalysisError
from app.fetcher import FetchedPage
from app.jobs import JobStore
from app.llm import record_usage
from app.pipeline import Deps, run_pipeline
from app.recommendations import filter_recommendations
from app.schemas import (
    AnalysisRequest, BusinessProfile, Capabilities, InferredText, LlmClaim, LlmProfile,
    LlmRecommendation, LlmReport, LlmTriage, LlmTriagePick, LlmVerdict, MarketDetection, PageCapture,
    Usage,
)
from app.text import quote_in_text

QUOTE = "Parfumuri nișă românești"


def rival_page(domain="rival.ro", **extra):
    fields = dict(
        url=f"https://{domain}/", title=domain, headings=[QUOTE],
        cta_texts=["Cumpără acum"], visible_text=f"{QUOTE}. Livrare în toată România.",
        screenshot_jpeg_base64="QUJD",
    )
    return PageCapture(**{**fields, **extra})


def own_page(**extra):
    return rival_page("own.ro", headings=["Our perfumes"], visible_text="Our perfumes.", **extra)


def candidate(domain="rival.ro"):
    return Candidate(domain, f"https://{domain}/p", f"https://{domain}/", domain, "s", [f"https://{domain}/p"])


def fetched_ok(domain="rival.ro", **extra):
    return FetchedPage(f"https://{domain}/", f"https://{domain}/", "ok", "", rival_page(domain, **extra))


def claim(*ids):
    return LlmClaim(text="A short claim.", evidence_ids=list(ids))


def verdict(domain="rival.ro", **extra):
    fields = dict(
        domain=domain, name=domain, category="direct", why_relevant="Sells the same products.",
        quotes=[QUOTE], market_status="confirmed", market_quote="Livrare în toată România",
        positioning=claim("e1"), visual=claim("e1"),
    )
    return LlmVerdict(**{**fields, **extra})


def recommendation(**extra):
    fields = dict(
        priority="medium", problem="p", evidence_ids=["e1"], website_change="w",
        example_headline="h", example_cta="c", expected_benefit_hypothesis="It might help.",
        assumptions=[], requires=[],
    )
    return LlmRecommendation(**{**fields, **extra})


def llm_report(verdicts=None, gap=None, recommendations=None):
    return LlmReport(
        verdicts=[verdict()] if verdicts is None else verdicts,
        gap_summary=gap or claim("e1"),
        recommendations=[recommendation() for _ in range(3)] if recommendations is None else recommendations,
    )


def profile():
    text = InferredText(value="Parfumuri")
    return BusinessProfile(
        url="https://own.ro/", domain="own.ro", business_name="Own",
        category=text, value_proposition=text, target_audience=text,
    )


MARKET = MarketDetection(country_code="RO", language="ro", status="detected", signals=[], note="")


def report(reply=None, fetched=None, candidates=None, market=MARKET, seen=None, capabilities=None):
    async def fake_llm(*, system, content, output):
        if seen is not None:
            seen.update(content=content, output=output, system=system)
        return reply or llm_report()

    return asyncio.run(build_report(
        fake_llm, profile(), market, own_page(),
        candidates or [candidate()], fetched or [fetched_ok()], capabilities or Capabilities(),
    ))


def test_quote_check_accepts_real_excerpts_and_rejects_paraphrases():
    text = "Livrare gratuită   în toată România, în 48 de ore."
    assert quote_in_text("livrare gratuita în toată românia", text)
    assert not quote_in_text("Livrăm repede în România", text)
    assert not quote_in_text("48", text)


def test_a_verified_competitor_carries_real_evidence():
    result = report()
    assert [c.domain for c in result.competitors] == ["rival.ro"]
    competitor = result.competitors[0]
    assert competitor.market_status == "confirmed"
    assert competitor.screenshot_data_url == "data:image/jpeg;base64,QUJD"
    saved = {item.id for item in result.evidence}
    assert competitor.evidence_ids and set(competitor.evidence_ids) <= saved
    assert result.skipped == []


def test_a_competitor_supported_only_by_invented_quotes_is_dropped():
    result = report(llm_report([verdict(quotes=["The biggest store in the country"])]))
    assert result.competitors == []
    assert result.skipped[0].status == "unverified"


def test_a_market_claim_without_a_real_quote_stays_unconfirmed():
    result = report(llm_report([verdict(market_quote="We ship anywhere")]))
    assert result.competitors[0].market_status == "unconfirmed"


def test_structured_shipping_confirms_the_market():
    result = report(llm_report([verdict(market_quote="")]), fetched=[fetched_ok(ships_to=["RO"])])
    assert result.competitors[0].market_status == "confirmed"


def test_other_markets_and_non_competitors_are_excluded_with_a_reason():
    assert report(llm_report([verdict(market_status="other_market")])).skipped[0].status == "other_market"
    assert report(llm_report([verdict(category="not_competitor")])).skipped[0].status == "not_competitor"


def test_a_verdict_for_a_page_we_never_read_is_ignored():
    result = report(llm_report([verdict(domain="invented.ro")]))
    assert result.competitors == []
    assert result.skipped[0].domain == "rival.ro"


def test_blocked_pages_are_reported_and_never_counted():
    result = report(fetched=[FetchedPage("https://rival.ro/", "https://rival.ro/", "blocked", "Refused")])
    assert result.competitors == []
    assert (result.skipped[0].status, result.skipped[0].reason) == ("blocked", "Refused")


def test_no_readable_page_makes_no_paid_call():
    called = []

    async def fake_llm(**_):
        called.append(1)

    fetched = [FetchedPage("https://rival.ro/", "https://rival.ro/", "blocked", "Refused")]
    asyncio.run(build_report(fake_llm, profile(), MARKET, own_page(), [candidate()], fetched, Capabilities()))
    assert called == []


def test_a_page_redirecting_to_the_users_own_site_is_not_a_competitor():
    fetched = [FetchedPage("https://rival.ro/", "https://own.ro/", "ok", "", rival_page())]
    result = report(fetched=fetched)
    assert result.competitors == []
    assert result.skipped[0].status == "not_competitor"


def test_at_most_three_competitors_with_direct_ones_first():
    domains = [f"r{i}.ro" for i in range(5)]
    verdicts = [verdict(d, category="indirect" if i < 2 else "direct") for i, d in enumerate(domains)]
    result = report(llm_report(verdicts), [fetched_ok(d) for d in domains], [candidate(d) for d in domains])
    assert [c.category for c in result.competitors] == ["direct"] * 3
    assert len(result.skipped) == 2


def test_evidence_of_rejected_sites_is_not_kept_or_citable():
    domains = ["good.ro", "bad.ro"]
    fetched = [fetched_ok(d) for d in domains]
    good_seen = {}
    book = EvidenceBook()
    book.add_site("own.ro", own_page())
    for page in fetched:
        book.add_site(page.url.split("/")[2], page.page)
    bad_id = next(item.id for item in book.items if item.domain == "bad.ro")
    verdicts = [verdict("good.ro"), verdict("bad.ro", category="not_competitor")]
    reply = llm_report(verdicts, recommendations=[recommendation(evidence_ids=[bad_id])])
    result = report(reply, fetched, [candidate(d) for d in domains], seen=good_seen)
    assert {item.domain for item in result.evidence} <= {"own.ro", "good.ro"}
    assert result.recommendations == []


def test_claims_without_saved_evidence_are_dropped():
    assert valid_claim(LlmClaim(text="Bad", evidence_ids=["e99"]), {"e1"}) is None
    kept = valid_claim(LlmClaim(text="Good", evidence_ids=["e1", "e99"]), {"e1"})
    assert kept.evidence_ids == ["e1"]


def test_evidence_codes_do_not_stay_inside_the_text():
    text = "Stands out with free shipping (e6, e9, e32). It also leads e4."
    kept = valid_claim(LlmClaim(text=text, evidence_ids=["e6"]), {"e6"})
    assert kept.text == "Stands out with free shipping. It also leads."


def test_a_gap_summary_without_evidence_does_not_appear():
    assert report(llm_report(gap=claim("e99"))).gap_summary is None


def test_screenshots_reach_claude_and_page_text_stays_delimited():
    seen = {}
    report(seen=seen)
    assert sum(block["type"] == "image" for block in seen["content"]) == 2
    assert seen["output"] is LlmReport
    text = seen["content"][-1]["text"]
    assert text.index("<page_data>") < text.index(QUOTE) < text.index("</page_data>")


def test_only_a_short_part_of_each_page_reaches_the_model_but_quotes_check_the_full_page():
    late = "A claim written near the end of a long page"
    body = f"{'x ' * config.PAGE_TEXT_FOR_MODEL}{late}"
    seen = {}
    fetched = [fetched_ok(visible_text=body)]
    result = report(llm_report([verdict(quotes=[late])]), fetched=fetched, seen=seen)
    assert late not in seen["content"][-1]["text"]
    assert [c.domain for c in result.competitors] == ["rival.ro"]


def test_a_visual_claim_must_cite_a_screenshot():
    book = EvidenceBook()
    book.add_site("own.ro", own_page())
    book.add_site("rival.ro", rival_page())
    text_id = next(item.id for item in book.items if item.kind == "text")
    shot_id = next(item.id for item in book.items if item.kind == "screenshot")
    assert report(llm_report([verdict(visual=claim(text_id))])).competitors[0].visual is None
    assert report(llm_report([verdict(visual=claim(shot_id))])).competitors[0].visual is not None


def test_recommendations_without_saved_evidence_are_removed():
    kept = filter_recommendations(
        [recommendation(), recommendation(evidence_ids=["e99"])], {"e1"}, Capabilities(),
    )
    assert len(kept) == 1


def test_an_undeclared_capability_becomes_a_visible_assumption():
    kept = filter_recommendations([recommendation(requires=["samples"])], {"e1"}, Capabilities())
    assert kept[0].assumptions == ["Assumes you can offer samples. You have not declared this."]
    kept = filter_recommendations([recommendation(requires=["samples"])], {"e1"}, Capabilities(samples=True))
    assert kept[0].assumptions == []


def test_recommendations_are_sorted_by_priority_and_capped_at_three():
    items = [recommendation(priority=p) for p in ("low", "high", "medium", "medium")]
    kept = filter_recommendations(items, {"e1"}, Capabilities())
    assert [item.priority for item in kept] == ["high", "medium", "medium"]


def test_usage_adds_up_at_the_published_rates():
    usage = Usage()
    record_usage(usage, 10_000, 1_000)
    record_usage(usage, 10_000, 1_000)
    assert (usage.calls, usage.input_tokens, usage.output_tokens) == (2, 20_000, 2_000)
    assert usage.estimated_cost_usd == 0.06


class Script:
    """Answers each Llm* schema with a canned reply, or raises it."""

    def __init__(self, **replies):
        self.calls = []
        self.replies = {
            "LlmProfile": LlmProfile(
                business_name="Own", category="Parfumuri", value_proposition="Nișă", target_audience="",
                language_code="ro", country_code="RO", country_quote="Livrare în toată România",
                search_queries=["parfumuri nișă"],
            ),
            "LlmTriage": LlmTriage(selected=[LlmTriagePick(domain="rival.ro", reason="r")]),
            "LlmReport": llm_report(),
            **replies,
        }

    async def __call__(self, *, system, content, output):
        self.calls.append(output.__name__)
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
    assert any("only 1 competitors" in warning for warning in view.warnings)
    ids = {item.id for item in view.result.evidence}
    assert all(set(r.evidence_ids) <= ids for r in view.result.recommendations)


def test_an_analysis_makes_exactly_three_model_calls(page):
    llm = Script()
    run_job(page, deps(llm=llm))
    assert llm.calls == ["LlmProfile", "LlmTriage", "LlmReport"]


def test_too_few_recommendations_are_reported_without_a_paid_retry(page):
    llm = Script(LlmReport=llm_report(recommendations=[recommendation()]))
    view = run_job(page, deps(llm=llm))
    assert llm.calls.count("LlmReport") == 1
    assert len(view.result.recommendations) == 1
    assert any("Only 1 recommendations" in warning for warning in view.warnings)


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
    view = run_job(page, deps(fetched=[fetched_ok()]))
    assert view.result.own_screenshot_data_url is None
    assert any("screenshot of your site" in warning for warning in view.warnings)


def test_research_failure_produces_no_competitors_and_keeps_the_profile(page):
    async def search(query, country):
        raise AnalysisError("search_auth", "The Tavily key in .env was not accepted.")

    dependencies = deps()
    dependencies.search = search
    view = run_job(page, dependencies)
    assert view.status == "partial"
    assert view.errors[0].stage == "discovery"
    assert view.result.profile and view.result.market
    assert view.result.competitors == []
    assert states(view)["discovery"] == "failed"
    assert states(view)["report"] == "skipped"


def test_no_search_results_is_reported_not_filled_in(page):
    view = run_job(page, deps(hits=[]))
    assert view.errors[0].code == "no_candidates"
    assert view.result.competitors == []


def test_all_pages_blocked_means_zero_competitors(page):
    fetched = [FetchedPage("https://rival.ro/", "https://rival.ro/", "blocked", "Refused")]
    view = run_job(page, deps(fetched=fetched))
    assert view.errors[0].code == "no_competitors"
    assert view.result.skipped[0].status == "blocked"
    assert view.result.recommendations == []


def test_a_report_failure_keeps_the_profile_and_market(page):
    llm = Script(LlmReport=AnalysisError("ai_status", "Claude returned error 500."))
    view = run_job(page, deps(llm=llm))
    assert view.status == "partial"
    assert view.result.profile and view.result.market
    assert states(view)["report"] == "failed"


def test_a_profile_failure_fails_the_job(page):
    llm = Script(LlmProfile=AnalysisError("ai_auth", "The Anthropic key in .env was not accepted."))
    view = run_job(page, deps(llm=llm))
    assert view.status == "failed"
    assert view.errors[0].code == "ai_auth"


def test_an_unexpected_error_hides_its_details(page):
    llm = Script(LlmTriage=RuntimeError("secret token sk-ant-xyz"))
    view = run_job(page, deps(llm=llm))
    assert view.errors[0].code == "internal"
    assert "sk-ant" not in view.errors[0].message
