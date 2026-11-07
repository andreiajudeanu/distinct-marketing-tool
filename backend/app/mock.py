"""Fixture results for local UI work. Kept apart from live code and always labelled SIMULATED."""

import json
import time

from . import config
from .jobs import Job, JobStore
from .schemas import AnalysisResult
from .text import hostname

STEP_DELAY_SECONDS = 0.35


def is_demo_url(url: str) -> bool:
    return hostname(url) in ("localhost", "127.0.0.1")


def load_fixture() -> AnalysisResult:
    raw = (config.FIXTURES / "demo_result.json").read_text(encoding="utf-8")
    return AnalysisResult.model_validate(json.loads(raw))


def run_mock(store: JobStore, job: Job) -> None:
    store.update(job, lambda target: setattr(target, "status", "running"))
    fixture = load_fixture()
    override = job.request.market_override
    if override and override.country_code and fixture.market:
        fixture.market.country_code = override.country_code.upper()
        fixture.market.status = "corrected"
        fixture.market.note = "Market corrected by you."
    for step in job.steps:
        store.set_step(job, step.id, "running")
        time.sleep(STEP_DELAY_SECONDS)
        store.set_step(job, step.id, "done")

    def finish(target: Job) -> None:
        target.result = fixture
        target.warnings.append("SIMULATED data from a local file. No real sites were contacted.")
        target.status = "done"

    store.update(job, finish)
