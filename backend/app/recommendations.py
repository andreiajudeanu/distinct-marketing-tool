"""Writes the three recommendations and removes any that lack saved evidence."""

import json

from .analysis import EvidenceBook
from .llm import LlmFn
from .schemas import (
    BusinessProfile, Capabilities, LlmRecommendation, LlmRecommendations, Recommendation,
)

TARGET_COUNT = 3
PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}
CAPABILITY_LABELS = {"samples": "mostre", "bundles": "pachete", "freeShipping": "livrare gratuită"}

SYSTEM = """Ești strateg de marketing pentru o afacere mică. Scrii exact 3 recomandări de diferențiere, ordonate după prioritate.
Scrii în limba română. example_headline și example_cta sunt în limba site-ului analizat.
Fiecare recomandare citează id-uri din lista de dovezi în evidence_ids.
Nu inventa capabilități, beneficii pentru clienți, cifre sau fapte despre afacere.
Dacă o recomandare depinde de o informație neverificată despre afacere, treci-o în assumptions.
requires listează ce trebuie să poată oferi magazinul dintre: samples, bundles, freeShipping.
expected_benefit_hypothesis e o ipoteză de testat, formulată condițional, nu un rezultat garantat.
Un lucru observat la un competitor e un semnal de investigat. Nu spune și nu sugera că i-a crescut vânzările.
Nu folosi scoruri sau procente inventate. Dacă example_headline sau example_cta nu au sens, lasă-le goale."""


def filter_recommendations(
    items: list[LlmRecommendation], allowed_ids: set[str], capabilities: Capabilities,
) -> list[Recommendation]:
    kept: list[Recommendation] = []
    for item in items:
        ids = [evidence_id for evidence_id in item.evidence_ids if evidence_id in allowed_ids]
        if not ids:
            continue
        assumptions = list(item.assumptions)
        for need in item.requires:
            if not getattr(capabilities, need):
                assumptions.append(f"Presupune că poți oferi {CAPABILITY_LABELS[need]}. Nu ai declarat asta.")
        kept.append(Recommendation(
            priority=item.priority,
            problem=item.problem,
            evidence_ids=ids,
            opportunity=item.opportunity,
            website_change=item.website_change,
            example_headline=item.example_headline,
            example_cta=item.example_cta,
            expected_benefit_hypothesis=item.expected_benefit_hypothesis,
            assumptions=assumptions,
        ))
    kept.sort(key=lambda item: PRIORITY_ORDER[item.priority])
    return kept[:TARGET_COUNT]


async def recommend(
    llm: LlmFn,
    profile: BusinessProfile,
    positioning_summary: str,
    book: EvidenceBook,
    capabilities: Capabilities,
    language: str,
) -> list[Recommendation]:
    evidence = [item.model_dump(include={"id", "domain", "kind", "field", "quote"}) for item in book.items]
    brief = {
        "afacere": profile.business_name,
        "domeniu": profile.domain,
        "categorie": profile.category.value,
        "produse": profile.products,
        "propunere": profile.value_proposition.value,
        "limba_site": language or "necunoscută",
        "capabilitati_declarate": capabilities.model_dump(),
    }
    prompt = (
        f"Afacerea: {json.dumps(brief, ensure_ascii=False)}\n\n"
        f"<date_pagini>\nSinteză: {positioning_summary}\n"
        f"Dovezi: {json.dumps(evidence, ensure_ascii=False)}\n</date_pagini>"
    )
    allowed = book.ids()
    best: list[Recommendation] = []
    for extra in ("", "\n\nFiecare din cele 3 recomandări are nevoie de cel puțin un id valid din listă."):
        result = await llm(
            system=SYSTEM,
            content=[{"type": "text", "text": prompt + extra}],
            output=LlmRecommendations,
        )
        current = filter_recommendations(result.recommendations, allowed, capabilities)
        if len(current) > len(best):
            best = current
        if len(best) >= TARGET_COUNT:
            break
    return best
