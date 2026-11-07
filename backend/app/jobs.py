"""Short-lived jobs kept in memory. A backend restart loses them, by design."""

import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from . import config
from .schemas import AnalysisRequest, AnalysisResult, ApiError, JobView, PageCapture, Step

STEPS = [
    ("profile", "Citesc site-ul tău"),
    ("market", "Stabilesc piața țintă"),
    ("discovery", "Caut competitori"),
    ("fetching", "Deschid paginile lor"),
    ("verification", "Verific competitorii"),
    ("comparison", "Compar mesajele și designul"),
    ("recommendations", "Scriu recomandările"),
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@dataclass
class Job:
    id: str
    request: AnalysisRequest
    page: PageCapture | None
    label: str
    created_at: str = field(default_factory=now_iso)
    updated_at: str = field(default_factory=now_iso)
    created_monotonic: float = field(default_factory=time.monotonic)
    status: str = "queued"
    steps: list[Step] = field(default_factory=lambda: [Step(id=i, label=l) for i, l in STEPS])
    result: AnalysisResult = field(default_factory=AnalysisResult)
    errors: list[ApiError] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    llm_profile: object | None = None


class JobStore:
    """All mutation goes through this lock: pipelines run on their own threads."""

    def __init__(self, ttl_seconds: int = config.JOB_TTL_SECONDS) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()
        self._ttl = ttl_seconds

    def _purge(self) -> None:
        limit = time.monotonic() - self._ttl
        expired = [
            job_id for job_id, job in self._jobs.items()
            if job.created_monotonic < limit and job.status not in ("queued", "running")
        ]
        for job_id in expired:
            del self._jobs[job_id]

    def create(self, request: AnalysisRequest, page: PageCapture | None, label: str) -> Job:
        with self._lock:
            self._purge()
            job = Job(id=uuid.uuid4().hex, request=request, page=page, label=label)
            self._jobs[job.id] = job
            return job

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            self._purge()
            return self._jobs.get(job_id)

    def running_count(self) -> int:
        with self._lock:
            return sum(job.status in ("queued", "running") for job in self._jobs.values())

    def update(self, job: Job, mutate) -> None:
        with self._lock:
            mutate(job)
            job.updated_at = now_iso()

    def set_step(self, job: Job, step_id: str, state: str, detail: str = "") -> None:
        def mutate(target: Job) -> None:
            for step in target.steps:
                if step.id == step_id:
                    step.state = state
                    step.detail = detail or step.detail
        self.update(job, mutate)

    def view(self, job: Job, include_screenshots: bool = False) -> JobView:
        with self._lock:
            view = JobView(
                job_id=job.id,
                status=job.status,
                label=job.label,
                created_at=job.created_at,
                updated_at=job.updated_at,
                steps=[step.model_copy() for step in job.steps],
                result=job.result.model_copy(deep=True),
                errors=list(job.errors),
                warnings=list(job.warnings),
            )
        if not include_screenshots:
            view.result.own_screenshot_data_url = None
            for competitor in view.result.competitors:
                competitor.screenshot_data_url = None
        return view
