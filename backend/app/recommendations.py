"""Removes recommendations without saved evidence and labels undeclared capabilities."""

from .schemas import Capabilities, LlmRecommendation, Recommendation

TARGET_COUNT = 3
PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}
CAPABILITY_LABELS = {"samples": "samples", "bundles": "bundles", "freeShipping": "free shipping"}


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
                assumptions.append(f"Assumes you can offer {CAPABILITY_LABELS[need]}. You have not declared this.")
        kept.append(Recommendation(
            priority=item.priority,
            problem=item.problem,
            evidence_ids=ids,
            website_change=item.website_change,
            example_headline=item.example_headline,
            example_cta=item.example_cta,
            expected_benefit_hypothesis=item.expected_benefit_hypothesis,
            assumptions=assumptions,
        ))
    kept.sort(key=lambda item: PRIORITY_ORDER[item.priority])
    return kept[:TARGET_COUNT]
