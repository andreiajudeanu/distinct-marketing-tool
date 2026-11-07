"""Runs one analysis from start to finish and publishes results as they appear."""

import logging
from dataclasses import dataclass

from . import config
from .analysis import EvidenceBook, compare, data_url, site_content, verify_competitors
from .discovery import SearchFn, filter_hits, search_all, tavily_search, triage, write_queries
from .errors import AnalysisError
from .fetcher import FetchFn, fetch_pages
from .jobs import Job, JobStore
from .llm import LlmFn, call_claude
from .market import detect_market
from .profile import extract_profile, to_business_profile
from .recommendations import TARGET_COUNT, recommend
from .schemas import ApiError, LlmProfile
from .text import registrable_domain

log = logging.getLogger("distinct.pipeline")

STAGES_AFTER = {
    "profile": ("market", "discovery", "fetching", "verification", "comparison", "recommendations"),
    "market": ("discovery", "fetching", "verification", "comparison", "recommendations"),
    "discovery": ("fetching", "verification", "comparison", "recommendations"),
    "fetching": ("verification", "comparison", "recommendations"),
    "verification": ("comparison", "recommendations"),
    "comparison": ("recommendations",),
    "recommendations": (),
}


@dataclass
class Deps:
    llm: LlmFn
    search: SearchFn
    fetch: FetchFn


def live_deps() -> Deps:
    return Deps(llm=call_claude, search=tavily_search, fetch=fetch_pages)


class Run:
    """Stage bookkeeping, so the pipeline below reads as a list of steps."""

    def __init__(self, store: JobStore, job: Job) -> None:
        self.store = store
        self.job = job
        self.stage = "profile"

    def start(self, stage: str) -> None:
        self.stage = stage
        self.store.set_step(self.job, stage, "running")

    def done(self, detail: str = "") -> None:
        self.store.set_step(self.job, self.stage, "done", detail)

    def publish(self, **fields) -> None:
        def mutate(job: Job) -> None:
            for name, value in fields.items():
                setattr(job.result, name, value)
        self.store.update(self.job, mutate)

    def warn(self, *messages: str) -> None:
        self.store.update(self.job, lambda job: job.warnings.extend(messages))

    def fail(self, code: str, message: str) -> None:
        def mutate(job: Job) -> None:
            job.errors.append(ApiError(code=code, stage=self.stage, message=message))
            job.status = "partial" if job.result.profile else "failed"
        self.store.update(self.job, mutate)
        self.store.set_step(self.job, self.stage, "failed", message)
        for stage in STAGES_AFTER[self.stage]:
            self.store.set_step(self.job, stage, "skipped")

    def finish(self) -> None:
        def mutate(job: Job) -> None:
            job.status = "partial" if job.errors else "done"
        self.store.update(self.job, mutate)


async def _run(run: Run, deps: Deps) -> None:
    job = run.job
    page = job.page

    run.start("profile")
    llm_profile: LlmProfile = job.llm_profile or await extract_profile(deps.llm, page)
    run.store.update(job, lambda target: setattr(target, "llm_profile", llm_profile))
    profile = to_business_profile(page, llm_profile)
    run.publish(profile=profile, own_screenshot_data_url=data_url(page))
    run.done()

    run.start("market")
    market = detect_market(page, llm_profile, job.request.market_override)
    run.publish(market=market)
    run.done(market.country_code or "Necunoscută")

    run.start("discovery")
    queries = await write_queries(deps.llm, profile, market)
    hits, warnings = await search_all(deps.search, queries, market.country_code)
    run.warn(*warnings)
    candidates = filter_hits(hits, page.url)
    run.publish(candidates_found=len(candidates))
    if not candidates:
        run.fail("no_candidates", "Căutarea nu a găsit candidați relevanți. Nu inventăm competitori.")
        return
    shortlist = await triage(deps.llm, profile, candidates)
    if not shortlist:
        run.fail("no_shortlist", "Niciun candidat nu pare competitor real. Nu inventăm competitori.")
        return
    run.done(f"{len(candidates)} candidați, {len(shortlist)} de verificat")

    run.start("fetching")
    urls = [candidate.homepage for candidate in shortlist]
    # Chrome may refuse a capture from the panel. The page is public, so the
    # backend can take it, with the same URL checks as any competitor.
    needs_own_shot = not page.screenshot_jpeg_base64
    fetched = await deps.fetch([*urls, page.url] if needs_own_shot else urls)
    own_fetch = next((item for item in fetched if item.url == page.url), None)
    fetched = [item for item in fetched if item.url != page.url]
    if own_fetch and own_fetch.page and own_fetch.page.screenshot_jpeg_base64:
        page = page.model_copy(update={"screenshot_jpeg_base64": own_fetch.page.screenshot_jpeg_base64})
        run.publish(own_screenshot_data_url=data_url(page))
    elif needs_own_shot:
        run.warn("Nu am putut salva captura site-ului tău. Observațiile vizuale sunt limitate.")
    readable = sum(item.status == "ok" for item in fetched)
    run.done(f"{readable} din {len(fetched)} pagini citite")

    run.start("verification")
    book = EvidenceBook()
    own_domain = registrable_domain(page.url)
    book.add_site(own_domain, page)
    competitors, skipped, captures = await verify_competitors(deps.llm, profile, market, shortlist, fetched, book)
    run.publish(competitors=competitors, skipped=skipped, evidence=list(book.items))
    if not competitors:
        run.fail("no_competitors", "Am găsit 0 competitori verificați. Nu inventăm competitori.")
        return
    run.done(f"{len(competitors)} competitori verificați")
    if len(competitors) < 3:
        run.warn(f"Am verificat doar {len(competitors)} competitori. Afișăm numărul real.")

    run.start("comparison")
    comparison, positioning, visual = await compare(deps.llm, own_domain, page, competitors, captures, book)
    run.publish(
        positioning_summary=comparison.positioning_summary,
        positioning=positioning,
        visual=visual,
        own_content=site_content(
            page, comparison.own_value_propositions, comparison.own_product_categories, comparison.own_pricing_position,
        ),
    )
    run.done()

    run.start("recommendations")
    recommendations = await recommend(
        deps.llm, profile, comparison.positioning_summary, book, job.request.capabilities, market.language,
    )
    run.publish(recommendations=recommendations)
    if len(recommendations) < TARGET_COUNT:
        run.warn(f"Doar {len(recommendations)} recomandări au dovezi salvate. Restul au fost eliminate.")
    run.done()
    run.finish()


async def run_pipeline(store: JobStore, job: Job, deps: Deps) -> None:
    store.update(job, lambda target: setattr(target, "status", "running"))
    run = Run(store, job)
    try:
        await _run(run, deps)
    except AnalysisError as error:
        run.fail(error.code, error.message)
    except Exception:
        log.exception("Analysis %s failed in stage %s", job.id, run.stage)
        run.fail("internal", "A apărut o eroare neașteptată. Detaliile sunt în consola serverului.")
