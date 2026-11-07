"""Starts the backend on localhost only. Run with: python backend/run.py"""

import logging
import sys
from pathlib import Path

import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app import config  # noqa: E402

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    uvicorn.run("app.main:app", host="127.0.0.1", port=config.backend_port(), log_level="info")
