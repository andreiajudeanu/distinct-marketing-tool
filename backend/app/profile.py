"""Turns the captured page into a business profile. Everything here is inferred."""

import json

from .llm import LlmFn, image_block
from .schemas import BusinessProfile, InferredText, LlmProfile, PageCapture
from .text import hostname

SYSTEM = """Ești analist de marketing. Din datele unui site scrii profilul afacerii, în limba română.
Separă ce scrie pe pagină de ce deduci. La *_basis spui pe scurt pe ce te bazezi.
Dacă un câmp nu reiese din pagină, lasă-l gol. Nu inventa produse sau beneficii.
language_code e codul ISO al limbii paginii.
country_code e țara în care vinde afacerea, cod ISO 3166 din două litere, doar dacă pagina o arată.
country_quote e fragmentul exact de pe pagină care arată asta: livrare, adresă, monedă locală.
Nu deduce țara din limba site-ului sau din domeniu. În acel caz lasă country_code și country_quote goale."""


def page_digest(page: PageCapture) -> dict:
    return page.model_dump(exclude={"screenshot_jpeg_base64", "http_status", "challenge"})


async def extract_profile(llm: LlmFn, page: PageCapture) -> LlmProfile:
    content: list[dict] = []
    if page.screenshot_jpeg_base64:
        content.append(image_block(page.screenshot_jpeg_base64))
    content.append({
        "type": "text",
        "text": f"<date_pagini>\n{json.dumps(page_digest(page), ensure_ascii=False)}\n</date_pagini>\n\n"
                "Scrie profilul afacerii.",
    })
    return await llm(system=SYSTEM, content=content, output=LlmProfile, effort="low")


def _inferred(value: str, basis: str = "") -> InferredText:
    return InferredText(value=value, status="inferred" if value else "unknown", basis=basis)


def to_business_profile(page: PageCapture, llm_profile: LlmProfile) -> BusinessProfile:
    return BusinessProfile(
        url=page.url,
        domain=hostname(page.url),
        title=page.title,
        meta_description=page.meta_description,
        business_name=llm_profile.business_name or hostname(page.url),
        category=_inferred(llm_profile.category),
        products=llm_profile.products[:12],
        value_proposition=_inferred(llm_profile.value_proposition, llm_profile.value_proposition_basis),
        target_audience=_inferred(llm_profile.target_audience, llm_profile.target_audience_basis),
        headings=page.headings[:8],
    )
