"""Turns the captured page into a business profile. Everything here is inferred."""

import json

from . import config
from .llm import LlmFn, image_block
from .schemas import BusinessProfile, InferredText, LlmProfile, PageCapture
from .text import hostname

SYSTEM = """You are a marketing analyst. From a website's data, write a short business profile in English.
If a field does not follow from the page, leave it empty. Do not invent products or benefits.
language_code is the ISO code of the page language.
country_code is the ISO 3166 two-letter country where the business sells, only if the page shows it.
country_quote is the exact fragment from the page that shows this: delivery, address, local currency.
Never infer the country from the site's language or domain. In that case leave both fields empty.
search_queries: at most 3 web searches, in the page language, that would find competitors' own websites.
Use concrete products. Avoid "top 10" style searches. Do not use the business name or a country name."""


def page_digest(page: PageCapture) -> dict:
    """The short version the model reads. The full text is kept to verify quotes."""
    return {
        "url": page.url,
        "title": page.title,
        "meta_description": page.meta_description,
        "lang": page.lang,
        "headings": page.headings[:6],
        "cta_texts": page.cta_texts[:6],
        "visible_text": page.visible_text[: config.PAGE_TEXT_FOR_MODEL],
        "prices": page.prices[:4],
        "currency": page.currency,
        "ships_to": page.ships_to[:5],
        "address_country": page.address_country,
    }


async def extract_profile(llm: LlmFn, page: PageCapture) -> LlmProfile:
    content: list[dict] = []
    if page.screenshot_jpeg_base64:
        content.append(image_block(page.screenshot_jpeg_base64))
    content.append({
        "type": "text",
        "text": f"<page_data>\n{json.dumps(page_digest(page), ensure_ascii=False)}\n</page_data>\n\n"
                "Write the business profile.",
    })
    return await llm(system=SYSTEM, content=content, output=LlmProfile)


def _inferred(value: str) -> InferredText:
    return InferredText(value=value, status="inferred" if value else "unknown")


def to_business_profile(page: PageCapture, llm_profile: LlmProfile) -> BusinessProfile:
    return BusinessProfile(
        url=page.url,
        domain=hostname(page.url),
        business_name=llm_profile.business_name or hostname(page.url),
        category=_inferred(llm_profile.category),
        value_proposition=_inferred(llm_profile.value_proposition),
        target_audience=_inferred(llm_profile.target_audience),
    )
