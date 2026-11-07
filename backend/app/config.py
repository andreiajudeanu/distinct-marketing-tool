"""Settings read from the environment. Keys stay here, on the server."""

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")

MODEL = "claude-sonnet-5-5"
FALLBACK_BETA = "server-side-fallback-2026-07-01"
EFFORT = "low"

# Base prices per million tokens, from the official pricing page, checked 2026-11-07.
INPUT_USD_PER_MTOK = 2.0
OUTPUT_USD_PER_MTOK = 10.0

EXTRACT_SCRIPT = ROOT / "extension" / "lib" / "extract-site.js"
FIXTURES = ROOT / "backend" / "fixtures"

JOB_TTL_SECONDS = 30 * 60
MAX_RUNNING_JOBS = 3
MAX_BODY_BYTES = 8_000_000

MAX_QUERIES = 3
RESULTS_PER_QUERY = 5
MAX_CANDIDATES = 15
MAX_PAGES_TO_FETCH = 5
MAX_COMPETITORS = 3
PAGE_TEXT_FOR_MODEL = 1500
FETCH_CONCURRENCY = 3
PAGE_TIMEOUT_MS = 20_000


def anthropic_key() -> str:
    return os.environ.get("ANTHROPIC_API_KEY", "").strip()


def tavily_key() -> str:
    return os.environ.get("TAVILY_API_KEY", "").strip()


def analysis_mode() -> str:
    return "mock" if os.environ.get("ANALYSIS_MODE", "live").strip() == "mock" else "live"


def backend_port() -> int:
    return int(os.environ.get("BACKEND_PORT", "8788"))


def extension_id() -> str:
    return os.environ.get("EXTENSION_ID", "").strip()
