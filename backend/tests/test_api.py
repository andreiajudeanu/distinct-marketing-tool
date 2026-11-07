"""API, job lifecycle, report reuse and CORS."""

import time

import pytest
from fastapi.testclient import TestClient

from app import config
from app.jobs import JobStore
from app.main import cors_pattern, create_app
from app.schemas import AnalysisRequest, PageCapture

ORIGIN = "chrome-extension://" + "a" * 32
DEMO_PAGE = {"url": "http://localhost:8787/demo/shop", "title": "Atelier Aroma"}


def wait_until_finished(client, job_id, timeout=6):
    limit = time.monotonic() + timeout
    while time.monotonic() < limit:
        job = client.get(f"/api/analyses/{job_id}").json()
        if job["status"] in ("done", "partial", "failed"):
            return job
        time.sleep(0.05)
    raise AssertionError("job did not finish")


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr("app.mock.STEP_DELAY_SECONDS", 0)
    return TestClient(create_app())


def test_health_reports_configuration_without_secrets(client):
    body = client.get("/api/health").json()
    assert body == {
        "status": "ok", "mode": "live", "anthropic_configured": True, "tavily_configured": True,
    }


def test_a_demo_page_runs_on_fixtures_and_is_labelled_simulated(client):
    created = client.post("/api/analyses", json={"page": DEMO_PAGE})
    assert created.status_code == 202
    assert created.json()["label"] == "SIMULATED"
    job = wait_until_finished(client, created.json()["job_id"])
    assert job["status"] == "done"
    assert job["label"] == "SIMULATED"
    assert len(job["result"]["recommendations"]) == 3
    assert job["usage"]["estimated_cost_usd"] == 0
    assert any("SIMULATED" in warning for warning in job["warnings"])


def test_fixture_claims_all_point_at_saved_evidence(client):
    created = client.post("/api/analyses", json={"page": DEMO_PAGE})
    result = wait_until_finished(client, created.json()["job_id"])["result"]
    ids = {item["id"] for item in result["evidence"]}
    cited = [i for r in result["recommendations"] for i in r["evidence_ids"]]
    cited += [i for c in result["competitors"] for i in c["evidence_ids"]]
    cited += [i for c in result["competitors"] for i in c["positioning"]["evidence_ids"]]
    cited += result["gap_summary"]["evidence_ids"]
    assert cited and set(cited) <= ids


def test_the_same_page_reuses_the_report_instead_of_paying_again(client):
    first = client.post("/api/analyses", json={"page": DEMO_PAGE}).json()
    wait_until_finished(client, first["job_id"])
    second = client.post("/api/analyses", json={"page": DEMO_PAGE}).json()
    assert second["job_id"] == first["job_id"]


def test_analyze_again_forces_a_new_report(client):
    first = client.post("/api/analyses", json={"page": DEMO_PAGE}).json()
    wait_until_finished(client, first["job_id"])
    second = client.post("/api/analyses", json={"page": DEMO_PAGE, "force": True}).json()
    assert second["job_id"] != first["job_id"]
    wait_until_finished(client, second["job_id"])


def test_a_different_page_is_not_reused(client):
    first = client.post("/api/analyses", json={"page": DEMO_PAGE}).json()
    wait_until_finished(client, first["job_id"])
    other = {"url": "http://localhost:8787/demo/rival-a"}
    second = client.post("/api/analyses", json={"page": other}).json()
    assert second["job_id"] != first["job_id"]
    wait_until_finished(client, second["job_id"])


def test_missing_keys_refuse_a_live_job_instead_of_inventing_results(monkeypatch, client):
    monkeypatch.setenv("TAVILY_API_KEY", "")
    response = client.post("/api/analyses", json={"page": {"url": "https://real.example/"}})
    assert response.status_code == 503
    assert "TAVILY_API_KEY" in response.json()["detail"]


def test_unknown_job_is_404(client):
    assert client.get("/api/analyses/none").status_code == 404


def test_a_request_needs_a_page(client):
    assert client.post("/api/analyses", json={}).status_code == 422


def test_non_http_pages_are_rejected(client):
    response = client.post("/api/analyses", json={"page": {"url": "file:///etc/passwd"}})
    assert response.status_code == 422


def test_rerun_of_an_expired_job_is_410(client):
    assert client.post("/api/analyses", json={"rerun_of": "gone"}).status_code == 410


def test_rerun_reuses_the_saved_page(client):
    first = client.post("/api/analyses", json={"page": DEMO_PAGE}).json()
    wait_until_finished(client, first["job_id"])
    second = client.post("/api/analyses", json={
        "rerun_of": first["job_id"], "market_override": {"country_code": "MD"},
    })
    assert second.status_code == 202
    job = wait_until_finished(client, second.json()["job_id"])
    assert job["job_id"] != first["job_id"]
    assert job["result"]["market"]["country_code"] == "MD"
    assert job["result"]["market"]["status"] == "corrected"


def test_rerun_keeps_the_declared_capabilities(client):
    first = client.post("/api/analyses", json={"page": DEMO_PAGE, "capabilities": {"samples": True}}).json()
    wait_until_finished(client, first["job_id"])
    second = client.post("/api/analyses", json={"rerun_of": first["job_id"]}).json()
    wait_until_finished(client, second["job_id"])
    assert client.app.state.jobs.get(second["job_id"]).request.capabilities.samples is True


def test_too_many_running_jobs_is_429(monkeypatch, client):
    monkeypatch.setattr(config, "MAX_RUNNING_JOBS", 0)
    assert client.post("/api/analyses", json={"page": DEMO_PAGE}).status_code == 429


def test_cors_allows_an_extension_and_refuses_a_website(client):
    allowed = client.get("/api/health", headers={"origin": ORIGIN})
    assert allowed.headers["access-control-allow-origin"] == ORIGIN
    refused = client.get("/api/health", headers={"origin": "https://evil.example"})
    assert "access-control-allow-origin" not in refused.headers


def test_cors_can_be_pinned_to_one_extension(monkeypatch):
    monkeypatch.setenv("EXTENSION_ID", "b" * 32)
    assert "bbbb" in cors_pattern()
    assert "[a-p]" not in cors_pattern()


def test_finished_jobs_expire_but_running_jobs_do_not():
    store = JobStore(ttl_seconds=-1)
    running = store.create(AnalysisRequest(), PageCapture(url="https://a.example/"), "LIVE")
    assert store.get(running.id) is running
    store.update(running, lambda job: setattr(job, "status", "done"))
    assert store.get(running.id) is None


def test_screenshots_stay_out_of_polling_responses():
    store = JobStore()
    job = store.create(AnalysisRequest(), PageCapture(url="https://a.example/"), "LIVE")
    job.result.own_screenshot_data_url = "data:image/jpeg;base64,AAAA"
    assert store.view(job).result.own_screenshot_data_url is None
    assert store.view(job, include_screenshots=True).result.own_screenshot_data_url
