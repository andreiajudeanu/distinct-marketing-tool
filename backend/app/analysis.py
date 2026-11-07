"""Verifies competitors against their pages and compares them with the user's site.

Claude proposes and the code decides. A quote must exist on the fetched page, and
a claim must cite evidence that was really saved, or it is dropped.
"""

import json

from . import config
from .discovery import Candidate
from .fetcher import FetchedPage
from .jobs import now_iso
from .llm import LlmFn, image_block
from .market import country_code
from .profile import page_digest
from .schemas import (
    BusinessProfile, Claim, Competitor, Evidence, LlmClaim, LlmComparison, LlmVerdict, LlmVerification,
    MarketDetection, PageCapture, PositioningComparison, SiteContent, SkippedSite, VisualComparison,
)
from .text import quote_in_text, registrable_domain

UNREAD = "Necitit"
MAX_FIELD_EVIDENCE = 4
CATEGORY_ORDER = {"direct": 0, "indirect": 1, "visual_reference": 2}
SCREENSHOT_NOTE = "Primul ecran al paginii, salvat la analiză."

VERIFY_SYSTEM = """Verifici dacă site-urile primite sunt competitori reali ai afacerii. Răspunzi în limba română.
Pentru fiecare site întoarce un verdict, cu domeniul exact din listă.
category: direct (aceleași produse, aceiași clienți), indirect (rezolvă aceeași nevoie altfel),
visual_reference (nu e competitor comercial, dar e relevant ca stil), not_competitor.
quotes: 1-4 fragmente copiate exact de pe pagina site-ului, care susțin clasificarea.
market_status: confirmed doar dacă pagina arată prezență comercială în țara țintă (livrare, adresă, prețuri locale),
iar market_quote e fragmentul exact care arată asta. other_market dacă pagina arată altă piață.
unconfirmed dacă pagina nu spune. Limba sau domeniul site-ului nu arată țara în care vinde.
pricing_position: descrie doar prețurile vizibile pe pagină. Dacă nu sunt, scrie „Necitit”.
Nu inventa nimic și nu folosi scoruri sau procente."""

COMPARE_SYSTEM = """Compari site-ul unei afaceri cu competitorii ei. Răspunzi în limba română.
Fiecare afirmație citează id-uri din lista de dovezi. Afirmațiile fără dovadă sunt eliminate.
positioning compară mesajele comerciale. visual compară doar ce se vede în capturi: paletă, ierarhie, densitate, stil.
Ține separate relevanța comercială și asemănarea vizuală. O dovadă de tip screenshot e obligatorie la visual.
Nu folosi scoruri sau procente. Nu afirma nimic despre vânzările sau rezultatele cuiva.
Pentru un competitor fără captură, întoarce liste goale la visual și scrie „Necitit” la layout.
La own_pricing_position descrie doar prețurile vizibile pe pagina afacerii sau scrie „Necitit”."""


class EvidenceBook:
    def __init__(self) -> None:
        self.items: list[Evidence] = []

    def add(self, domain: str, url: str, kind: str, field: str, quote: str) -> str:
        evidence_id = f"e{len(self.items) + 1}"
        self.items.append(Evidence(
            id=evidence_id, domain=domain, url=url, kind=kind, field=field,
            quote=quote[:300], captured_at=now_iso(),
        ))
        return evidence_id

    def add_site(self, domain: str, page: PageCapture) -> list[str]:
        ids: list[str] = []
        if page.meta_description:
            ids.append(self.add(domain, page.url, "text", "descriere meta", page.meta_description))
        for heading in page.headings[:MAX_FIELD_EVIDENCE]:
            ids.append(self.add(domain, page.url, "text", "titlu", heading))
        for cta in page.cta_texts[:MAX_FIELD_EVIDENCE]:
            ids.append(self.add(domain, page.url, "text", "buton", cta))
        if page.screenshot_jpeg_base64:
            ids.append(self.add(domain, page.url, "screenshot", "captură", SCREENSHOT_NOTE))
        return ids

    def ids(self) -> set[str]:
        return {item.id for item in self.items}

    def screenshot_ids(self) -> set[str]:
        return {item.id for item in self.items if item.kind == "screenshot"}

    def by_domain(self, domain: str, kind: str) -> str | None:
        return next((item.id for item in self.items if item.domain == domain and item.kind == kind), None)


def page_text(page: PageCapture) -> str:
    return " ".join([page.title, page.meta_description, *page.headings, *page.cta_texts, page.visible_text])


def data_url(page: PageCapture) -> str | None:
    return f"data:image/jpeg;base64,{page.screenshot_jpeg_base64}" if page.screenshot_jpeg_base64 else None


def site_content(page: PageCapture, values: list[str], categories: list[str], pricing: str) -> SiteContent:
    return SiteContent(
        headlines=page.headings[:6],
        ctas=page.cta_texts[:6],
        value_propositions=values[:5],
        product_categories=categories[:8],
        pricing_position=pricing or UNREAD,
        page_structure=page.structure[:10],
        palette=page.colors[:8],
        fonts=page.fonts[:4],
    )


def _skip(page: FetchedPage, domain: str) -> SkippedSite:
    return SkippedSite(domain=domain, url=page.url, status=page.status, reason=page.reason)


async def verify_competitors(
    llm: LlmFn,
    profile: BusinessProfile,
    market: MarketDetection,
    candidates: list[Candidate],
    fetched: list[FetchedPage],
    book: EvidenceBook,
) -> tuple[list[Competitor], list[SkippedSite], dict[str, PageCapture]]:
    own = registrable_domain(profile.url)
    by_url = {candidate.homepage: candidate for candidate in candidates}
    pages: dict[str, tuple[Candidate, PageCapture]] = {}
    skipped: list[SkippedSite] = []
    for item in fetched:
        candidate = by_url.get(item.url)
        domain = candidate.domain if candidate else registrable_domain(item.url)
        if item.status != "ok" or item.page is None or candidate is None:
            skipped.append(_skip(item, domain))
        elif registrable_domain(item.final_url) == own:
            skipped.append(SkippedSite(domain=domain, url=item.url, status="not_competitor",
                                       reason="Pagina duce către site-ul tău."))
        else:
            pages[domain] = (candidate, item.page)

    if not pages:
        return [], skipped, {}

    listing = {domain: page_digest(page) for domain, (_, page) in pages.items()}
    brief = {
        "afacere": profile.business_name,
        "categorie": profile.category.value,
        "produse": profile.products,
        "public": profile.target_audience.value,
        "tara_tinta": market.country_code or "necunoscută",
    }
    result = await llm(
        system=VERIFY_SYSTEM,
        content=[{
            "type": "text",
            "text": f"Afacerea: {json.dumps(brief, ensure_ascii=False)}\n\n"
                    f"<date_pagini>\n{json.dumps(listing, ensure_ascii=False)}\n</date_pagini>",
        }],
        output=LlmVerification,
    )

    verdicts: dict[str, LlmVerdict] = {}
    for verdict in result.verdicts:
        domain = registrable_domain(verdict.domain)
        if domain in pages:
            verdicts.setdefault(domain, verdict)

    accepted: list[tuple[Competitor, PageCapture]] = []
    for domain, (candidate, page) in pages.items():
        verdict = verdicts.get(domain)
        if verdict is None or verdict.category == "not_competitor":
            reason = verdict.why_relevant if verdict else "Nu am putut verifica relevanța."
            skipped.append(SkippedSite(domain=domain, url=page.url, status="not_competitor", reason=reason))
            continue
        if verdict.market_status == "other_market" and verdict.category != "visual_reference":
            skipped.append(SkippedSite(domain=domain, url=page.url, status="other_market", reason=verdict.why_relevant))
            continue

        text = page_text(page)
        quotes = [quote for quote in verdict.quotes if quote_in_text(quote, text)]
        if not quotes:
            skipped.append(SkippedSite(domain=domain, url=page.url, status="unverified",
                                       reason="Motivele propuse nu apar pe pagina citită."))
            continue

        confirmed = market.status != "unknown" and (
            quote_in_text(verdict.market_quote, text)
            or market.country_code in {country_code(value) for value in page.ships_to}
        )
        evidence_ids = [book.add(domain, page.url, "text", "citat", quote) for quote in quotes[:4]]
        accepted.append((Competitor(
            name=verdict.name or domain,
            url=page.url,
            domain=domain,
            category=verdict.category,
            market_status="confirmed" if confirmed else "unconfirmed",
            why_relevant=verdict.why_relevant,
            evidence_ids=evidence_ids,
            source_urls=candidate.source_urls[:3],
            content=site_content(page, verdict.value_propositions, verdict.product_categories, verdict.pricing_position),
            screenshot_data_url=data_url(page),
        ), page))

    accepted.sort(key=lambda pair: (CATEGORY_ORDER[pair[0].category], pair[0].market_status != "confirmed"))
    chosen = accepted[: config.MAX_COMPETITORS]
    for competitor, page in accepted[config.MAX_COMPETITORS:]:
        skipped.append(SkippedSite(domain=competitor.domain, url=page.url, status="unverified",
                                   reason="Peste limita de 5 competitori."))
    captures: dict[str, PageCapture] = {}
    competitors: list[Competitor] = []
    for competitor, page in chosen:
        competitor.evidence_ids += book.add_site(competitor.domain, page)
        captures[competitor.domain] = page
        competitors.append(competitor)
    return competitors, skipped, captures


def valid_claims(claims: list[LlmClaim], allowed: set[str]) -> list[Claim]:
    kept: list[Claim] = []
    for claim in claims:
        ids = [evidence_id for evidence_id in claim.evidence_ids if evidence_id in allowed]
        if ids and claim.text.strip():
            kept.append(Claim(text=claim.text, evidence_ids=ids))
    return kept


async def compare(
    llm: LlmFn,
    own_domain: str,
    own_page: PageCapture,
    competitors: list[Competitor],
    captures: dict[str, PageCapture],
    book: EvidenceBook,
) -> tuple[LlmComparison, list[PositioningComparison], list[VisualComparison]]:
    content: list[dict] = []
    if own_page.screenshot_jpeg_base64:
        content.append({"type": "text", "text": f"Captură pentru {own_domain}, dovada {book.by_domain(own_domain, 'screenshot')}:"})
        content.append(image_block(own_page.screenshot_jpeg_base64))
    for competitor in competitors:
        page = captures[competitor.domain]
        if page.screenshot_jpeg_base64:
            content.append({"type": "text", "text": f"Captură pentru {competitor.domain}, dovada {book.by_domain(competitor.domain, 'screenshot')}:"})
            content.append(image_block(page.screenshot_jpeg_base64))

    evidence = [item.model_dump(include={"id", "domain", "kind", "field", "quote"}) for item in book.items]
    sites = {
        own_domain: {"rol": "afacerea analizată", **page_digest(own_page)},
        **{
            competitor.domain: {"rol": competitor.category, **competitor.content.model_dump()}
            for competitor in competitors
        },
    }
    content.append({
        "type": "text",
        "text": f"<date_pagini>\nSite-uri: {json.dumps(sites, ensure_ascii=False)}\n"
                f"Dovezi: {json.dumps(evidence, ensure_ascii=False)}\n</date_pagini>\n\n"
                f"Întoarce câte o intrare pentru fiecare competitor, cu domeniul exact.",
    })
    result = await llm(system=COMPARE_SYSTEM, content=content, output=LlmComparison)

    known = {competitor.domain for competitor in competitors}
    ids = book.ids()
    shots = book.screenshot_ids()
    positioning = [
        PositioningComparison(
            domain=entry.domain,
            similarities=valid_claims(entry.similarities, ids),
            differences=valid_claims(entry.differences, ids),
        )
        for entry in result.positioning if entry.domain in known
    ]
    visual = [
        VisualComparison(
            domain=entry.domain,
            similarities=[claim for claim in valid_claims(entry.similarities, ids) if set(claim.evidence_ids) & shots],
            differences=[claim for claim in valid_claims(entry.differences, ids) if set(claim.evidence_ids) & shots],
            layout=entry.layout or UNREAD,
        )
        for entry in result.visual if entry.domain in known
    ]
    return result, positioning, visual
