"""Small pure helpers for domains and for checking quotes against page text."""

import re
import unicodedata
from urllib.parse import urlsplit

TWO_LEVEL_SUFFIXES = {
    "co.uk", "org.uk", "ac.uk", "com.au", "net.au", "co.nz", "co.jp", "co.kr", "com.br",
    "com.mx", "com.tr", "co.za", "com.cn", "com.hk", "com.sg", "co.in", "com.ar", "com.pl",
}
MIN_QUOTE_CHARS = 8


def hostname(url: str) -> str:
    return (urlsplit(url).hostname or "").lower().removeprefix("www.")


def registrable_domain(url_or_host: str) -> str:
    host = hostname(url_or_host) if "//" in url_or_host else url_or_host.lower().removeprefix("www.")
    parts = host.split(".")
    if len(parts) >= 3 and ".".join(parts[-2:]) in TWO_LEVEL_SUFFIXES:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:]) if len(parts) >= 2 else host


def normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text)
    stripped = "".join(char for char in decomposed if not unicodedata.combining(char))
    quotes = stripped.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"').replace("„", '"')
    return re.sub(r"\s+", " ", quotes).strip().casefold()


def quote_in_text(quote: str, text: str) -> bool:
    """True only for a real excerpt. Claude's paraphrases do not count as evidence."""
    needle = normalize(quote)
    return len(needle) >= MIN_QUOTE_CHARS and needle in normalize(text)
