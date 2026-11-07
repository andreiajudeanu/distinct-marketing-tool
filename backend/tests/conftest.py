import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.schemas import PageCapture  # noqa: E402


@pytest.fixture(autouse=True)
def no_real_keys(monkeypatch):
    """Tests must never reach a paid API, even with a real .env on disk."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setenv("TAVILY_API_KEY", "test-key")
    monkeypatch.setenv("ANALYSIS_MODE", "live")
    monkeypatch.delenv("EXTENSION_ID", raising=False)


@pytest.fixture
def page():
    return PageCapture(
        url="https://www.atelier.example/produs",
        title="Atelier Aroma",
        meta_description="Parfumuri nișă lucrate manual.",
        lang="ro",
        headings=["Parfumuri nișă lucrate manual", "Livrare în toată România"],
        cta_texts=["Adaugă în coș"],
        visible_text="Parfumuri nișă lucrate manual. Livrare în toată România în 48 de ore.",
    )
