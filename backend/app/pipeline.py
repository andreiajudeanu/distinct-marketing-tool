"""Runs one analysis from start to finish and publishes results as they appear."""

import logging
from dataclasses import dataclass

from . import config
from .analysis import build_report, data_url
from .discovery import SearchFn, filter_hits, search_all, tavily_search, triage, usable_queries
from .errors import AnalysisError
from .fetcher import FetchFn, fetch_pages
from .jobs import STEPS, Job, JobStore
from .llm import LlmFn, call_claude, current_usage
from .market import detect_market
from .profile import extract_profile, to_business_profile
from .recommendations import TARGET_COUNT
from .schemas import ApiError, LlmProfile

log = logging.getLogger("distinct.pipeline")

STAGE_ORDER = [step_id for step_id, _ in STEPS]


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
        for stage in STAGE_ORDER[STAGE_ORDER.index(self.stage) + 1:]:
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
    run.done(market.country_code or "Unknown")

    run.start("discovery")
    queries = usable_queries(llm_profile.search_queries)
    hits, warnings = await search_all(deps.search, queries, market.country_code)
    run.warn(*warnings)
    candidates = filter_hits(hits, page.url)
    run.publish(candidates_found=len(candidates))
    if not candidates:
        run.fail("no_candidates", "The search found no relevant candidates. We do not invent competitors.")
        return
    shortlist = await triage(deps.llm, profile, candidates)
    if not shortlist:
        run.fail("no_shortlist", "No candidate looks like a real competitor. We do not invent competitors.")
        return
    run.done(f"{len(candidates)} candidates, {len(shortlist)} to check")

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
        run.warn("We could not save a screenshot of your site. Visual notes are limited.")
    readable = sum(item.status == "ok" for item in fetched)
    run.done(f"{readable} of {len(fetched)} pages read")

    run.start("report")
    report = await build_report(
        deps.llm, profile, market, page, shortlist, fetched, job.request.capabilities,
    )
    run.publish(
        competitors=report.competitors,
        skipped=report.skipped,
        gap_summary=report.gap_summary,
        recommendations=report.recommendations,
        evidence=report.evidence,
    )
    if not report.competitors:
        run.fail("no_competitors", "We verified 0 competitors. We do not invent competitors.")
        return
    if len(report.competitors) < config.MAX_COMPETITORS:
        run.warn(f"We verified only {len(report.competitors)} competitors. This is the real number.")
    if len(report.recommendations) < TARGET_COUNT:
        run.warn(f"Only {len(report.recommendations)} recommendations have saved evidence. The rest were removed.")
    run.done(f"{len(report.competitors)} competitors verified")
    run.finish()


async def run_pipeline(store: JobStore, job: Job, deps: Deps) -> None:
    store.update(job, lambda target: setattr(target, "status", "running"))
    current_usage.set(job.usage)
    run = Run(store, job)
    try:
        await _run(run, deps)
    except AnalysisError as error:
        run.fail(error.code, error.message)
    except Exception:
        log.exception("Analysis %s failed in stage %s", job.id, run.stage)
        run.fail("internal", "Something unexpected went wrong. Details are in the server console.")
    log.info("Analysis %s: %s calls, %s in, %s out, about $%.3f", job.id, job.usage.calls,
             job.usage.input_tokens, job.usage.output_tokens, job.usage.estimated_cost_usd)
