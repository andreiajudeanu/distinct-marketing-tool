"""Decides the target market from evidence, and labels how sure that decision is.

Language and top-level domain are recorded but never decide a country: a Romanian
site can sell in Moldova, and a .com site can sell anywhere.
"""

import re

from .schemas import LlmProfile, MarketDetection, MarketOverride, MarketSignal, PageCapture
from .text import hostname, quote_in_text

SINGLE_COUNTRY_CURRENCY = {
    "RON": "RO", "GBP": "GB", "PLN": "PL", "HUF": "HU", "CZK": "CZ", "BGN": "BG",
    "SEK": "SE", "DKK": "DK", "NOK": "NO", "CHF": "CH", "USD": "US", "CAD": "CA",
    "AUD": "AU", "JPY": "JP", "MDL": "MD", "TRY": "TR",
}
COUNTRY_NAMES = {
    "romania": "RO", "românia": "RO", "germany": "DE", "deutschland": "DE", "france": "FR",
    "united kingdom": "GB", "uk": "GB", "united states": "US", "usa": "US", "italy": "IT",
    "spain": "ES", "poland": "PL", "hungary": "HU", "bulgaria": "BG", "moldova": "MD",
}


def country_code(value: str) -> str:
    text = value.strip()
    if len(text) == 2 and text.isalpha():
        return text.upper()
    return COUNTRY_NAMES.get(text.casefold(), "")


def region_of(locale: str) -> str:
    match = re.fullmatch(r"[a-zA-Z]{2,3}[-_]([a-zA-Z]{2})", locale.strip())
    return match.group(1).upper() if match else ""


def collect_signals(page: PageCapture) -> list[MarketSignal]:
    signals: list[MarketSignal] = []
    if page.address_country:
        signals.append(MarketSignal(kind="adresă în date structurate", value=page.address_country, strength="strong"))
    for destination in page.ships_to[:6]:
        signals.append(MarketSignal(kind="livrare în date structurate", value=destination, strength="strong"))
    if page.currency:
        signals.append(MarketSignal(kind="monedă", value=page.currency.upper(), strength="medium"))
    if region_of(page.og_locale):
        signals.append(MarketSignal(kind="og:locale", value=page.og_locale, strength="medium"))
    for locale in page.hreflang[:6]:
        if region_of(locale):
            signals.append(MarketSignal(kind="hreflang", value=locale, strength="medium"))
    if page.lang:
        signals.append(MarketSignal(kind="limba paginii", value=page.lang, strength="weak"))
    domain = hostname(page.url)
    if "." in domain:
        signals.append(MarketSignal(kind="domeniu", value=f".{domain.rsplit('.', 1)[-1]}", strength="weak"))
    return signals


def _signal_country(signal: MarketSignal) -> str:
    if signal.kind == "monedă":
        return SINGLE_COUNTRY_CURRENCY.get(signal.value, "")
    if signal.kind in ("og:locale", "hreflang"):
        return region_of(signal.value)
    if signal.strength == "strong":
        return country_code(signal.value)
    return ""


def _page_text(page: PageCapture) -> str:
    return " ".join([page.title, page.meta_description, *page.headings, page.visible_text])


def detect_market(page: PageCapture, profile: LlmProfile, override: MarketOverride | None) -> MarketDetection:
    signals = collect_signals(page)
    language = (profile.language_code or page.lang)[:2].lower()

    if override and override.country_code:
        return MarketDetection(
            country_code=override.country_code.upper(),
            language=(override.language or language)[:2].lower(),
            status="corrected",
            signals=signals,
            note="Piață corectată de tine.",
        )

    guess = country_code(profile.country_code)
    quote_ok = bool(guess) and quote_in_text(profile.country_quote, _page_text(page))
    if quote_ok:
        signals.insert(0, MarketSignal(kind="text de pe pagină", value=profile.country_quote[:160], strength="strong"))

    support = [signal for signal in signals if signal.strength != "weak" and _signal_country(signal)]
    if not guess and support:
        strongest = next((s for s in support if s.strength == "strong"), support[0])
        guess = _signal_country(strongest)

    backed = quote_ok or any(_signal_country(signal) == guess for signal in support)
    if guess and backed:
        return MarketDetection(
            country_code=guess, language=language, status="detected", signals=signals,
            note="Dedusă din semnalele de mai jos. Corecteaz-o dacă e greșită.",
        )
    if guess:
        return MarketDetection(
            country_code=guess, language=language, status="unconfirmed", signals=signals,
            note="Piață neconfirmată: nu am găsit livrare, adresă sau monedă care să o susțină.",
        )
    return MarketDetection(
        country_code="", language=language, status="unknown", signals=signals,
        note="Nu am găsit semnale de piață. Limba și domeniul nu stabilesc o țară.",
    )
