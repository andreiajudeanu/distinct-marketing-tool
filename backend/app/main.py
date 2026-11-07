"""HTTP API. It starts jobs and reports on them. The work lives in pipeline.py."""

import asyncio
import re
import threading

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import config
from .jobs import JobStore
from .mock import is_demo_url, run_mock
from .pipeline import Deps, live_deps, run_pipeline
from .schemas import AnalysisRequest, Health, JobView


def cors_pattern() -> str:
    extension = config.extension_id()
    return f"^chrome-extension://{re.escape(extension)}$" if extension else r"^chrome-extension://[a-p]{32}$"


def create_app(deps: Deps | None = None) -> FastAPI:
    app = FastAPI(title="Distinct Watch analysis")
    app.state.jobs = JobStore()
    app.state.deps = deps
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=cors_pattern(),
        allow_methods=["GET", "POST"],
        allow_headers=["content-type"],
    )

    @app.middleware("http")
    async def limit_body(request: Request, call_next):
        length = request.headers.get("content-length", "0")
        if length.isdigit() and int(length) > config.MAX_BODY_BYTES:
            return JSONResponse(status_code=413, content={"detail": "Pagina trimisă e prea mare."})
        return await call_next(request)

    @app.get("/api/health", response_model=Health)
    def health() -> Health:
        return Health(
            status="ok",
            mode=config.analysis_mode(),
            anthropic_configured=bool(config.anthropic_key()),
            tavily_configured=bool(config.tavily_key()),
        )

    @app.post("/api/analyses", response_model=JobView, status_code=202)
    def create_analysis(body: AnalysisRequest) -> JobView:
        store: JobStore = app.state.jobs
        if store.running_count() >= config.MAX_RUNNING_JOBS:
            raise HTTPException(429, "Rulează deja prea multe analize. Încearcă peste câteva minute.")

        previous = store.get(body.rerun_of) if body.rerun_of else None
        if body.rerun_of and (previous is None or previous.page is None):
            raise HTTPException(410, "Analiza inițială a expirat. Pornește una nouă din extensie.")
        page = previous.page if previous else body.page
        if previous:
            body.capabilities = previous.request.capabilities
        if page is None:
            raise HTTPException(422, "Lipsește pagina de analizat.")

        mock = body.mock or config.analysis_mode() == "mock" or is_demo_url(page.url)
        if not mock:
            missing = [
                name for name, value in
                (("ANTHROPIC_API_KEY", config.anthropic_key()), ("TAVILY_API_KEY", config.tavily_key()))
                if not value
            ]
            if missing:
                raise HTTPException(503, f"Lipsește din .env: {', '.join(missing)}. Nu inventăm rezultate.")

        job = store.create(body, page, "SIMULAT" if mock else "LIVE")
        if previous:
            job.llm_profile = previous.llm_profile
        deps = app.state.deps
        target = (lambda: run_mock(store, job)) if mock else (
            lambda: asyncio.run(run_pipeline(store, job, deps or live_deps()))
        )
        # Own thread and event loop: polling stays fast, and Playwright gets a loop
        # that can start subprocesses on Windows whatever loop the server runs on.
        threading.Thread(target=target, daemon=True, name=f"job-{job.id[:8]}").start()
        return store.view(job)

    @app.get("/api/analyses/{job_id}", response_model=JobView)
    def read_analysis(job_id: str, screenshots: bool = False) -> JobView:
        store: JobStore = app.state.jobs
        job = store.get(job_id)
        if job is None:
            raise HTTPException(404, "Analiza nu mai există. Joburile țin 30 de minute în memorie.")
        return store.view(job, include_screenshots=screenshots)

    return app


app = create_app()
