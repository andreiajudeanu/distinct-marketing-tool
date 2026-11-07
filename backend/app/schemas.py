"""Every shape that crosses a boundary: API, model output and page capture.

Two families live here. API models describe what the extension sends and
receives. Llm* models describe what Claude must return. Their JSON schema is
sent with the request, so all their fields are required and extras are forbidden.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

MAX_TEXT = 12_000
MAX_SCREENSHOT = 6_000_000


class PageCapture(BaseModel):
    """What extension/lib/extract-site.js reads from a page."""

    url: str = Field(max_length=2000)
    title: str = Field(default="", max_length=500)
    meta_description: str = Field(default="", max_length=1000)
    lang: str = Field(default="", max_length=20)
    headings: list[str] = Field(default_factory=list, max_length=40)
    cta_texts: list[str] = Field(default_factory=list, max_length=40)
    nav_labels: list[str] = Field(default_factory=list, max_length=40)
    structure: list[str] = Field(default_factory=list, max_length=30)
    visible_text: str = Field(default="", max_length=MAX_TEXT)
    colors: list[str] = Field(default_factory=list, max_length=20)
    fonts: list[str] = Field(default_factory=list, max_length=10)
    prices: list[str] = Field(default_factory=list, max_length=20)
    currency: str = Field(default="", max_length=10)
    ships_to: list[str] = Field(default_factory=list, max_length=40)
    address_country: str = Field(default="", max_length=60)
    hreflang: list[str] = Field(default_factory=list, max_length=60)
    og_locale: str = Field(default="", max_length=20)
    http_status: int = 0
    challenge: bool = False
    screenshot_jpeg_base64: str | None = Field(default=None, max_length=MAX_SCREENSHOT)

    @field_validator("url")
    @classmethod
    def http_only(cls, value: str) -> str:
        if not value.startswith(("http://", "https://")):
            raise ValueError("URL-ul trebuie să fie http sau https.")
        return value


class MarketOverride(BaseModel):
    country_code: str = Field(default="", max_length=2)
    language: str = Field(default="", max_length=10)


class Capabilities(BaseModel):
    samples: bool = False
    bundles: bool = False
    freeShipping: bool = False


class AnalysisRequest(BaseModel):
    page: PageCapture | None = None
    rerun_of: str | None = Field(default=None, max_length=64)
    market_override: MarketOverride | None = None
    capabilities: Capabilities = Field(default_factory=Capabilities)
    mock: bool = False


class Claim(BaseModel):
    text: str
    evidence_ids: list[str]


class Evidence(BaseModel):
    id: str
    domain: str
    url: str
    kind: Literal["text", "screenshot"]
    field: str
    quote: str
    captured_at: str


class InferredText(BaseModel):
    value: str
    status: Literal["inferred", "unknown"] = "inferred"
    basis: str = ""


class BusinessProfile(BaseModel):
    url: str
    domain: str
    title: str
    meta_description: str
    business_name: str
    category: InferredText
    products: list[str]
    value_proposition: InferredText
    target_audience: InferredText
    headings: list[str]


class MarketSignal(BaseModel):
    kind: str
    value: str
    strength: Literal["strong", "medium", "weak"]


class MarketDetection(BaseModel):
    country_code: str
    language: str
    status: Literal["detected", "unconfirmed", "corrected", "unknown"]
    signals: list[MarketSignal]
    note: str


class SiteContent(BaseModel):
    headlines: list[str]
    ctas: list[str]
    value_propositions: list[str]
    product_categories: list[str]
    pricing_position: str
    page_structure: list[str]
    palette: list[str]
    fonts: list[str]


class Competitor(BaseModel):
    name: str
    url: str
    domain: str
    category: Literal["direct", "indirect", "visual_reference"]
    market_status: Literal["confirmed", "unconfirmed"]
    why_relevant: str
    evidence_ids: list[str]
    source_urls: list[str]
    content: SiteContent
    screenshot_data_url: str | None = None


class SkippedSite(BaseModel):
    domain: str
    url: str
    status: Literal[
        "blocked", "unavailable", "robots", "unsafe", "failed",
        "not_competitor", "other_market", "unverified",
    ]
    reason: str


class PositioningComparison(BaseModel):
    domain: str
    similarities: list[Claim]
    differences: list[Claim]


class VisualComparison(BaseModel):
    domain: str
    similarities: list[Claim]
    differences: list[Claim]
    layout: str


class Recommendation(BaseModel):
    priority: Literal["high", "medium", "low"]
    problem: str
    evidence_ids: list[str]
    opportunity: str
    website_change: str
    example_headline: str
    example_cta: str
    expected_benefit_hypothesis: str
    assumptions: list[str]


class AnalysisResult(BaseModel):
    profile: BusinessProfile | None = None
    market: MarketDetection | None = None
    own_content: SiteContent | None = None
    own_screenshot_data_url: str | None = None
    competitors: list[Competitor] = Field(default_factory=list)
    skipped: list[SkippedSite] = Field(default_factory=list)
    candidates_found: int = 0
    positioning_summary: str = ""
    positioning: list[PositioningComparison] = Field(default_factory=list)
    visual: list[VisualComparison] = Field(default_factory=list)
    recommendations: list[Recommendation] = Field(default_factory=list)
    evidence: list[Evidence] = Field(default_factory=list)


class ApiError(BaseModel):
    code: str
    stage: str
    message: str


class Step(BaseModel):
    id: str
    label: str
    state: Literal["pending", "running", "done", "failed", "skipped"] = "pending"
    detail: str = ""


class JobView(BaseModel):
    job_id: str
    status: Literal["queued", "running", "done", "partial", "failed"]
    label: Literal["LIVE", "SIMULAT"]
    created_at: str
    updated_at: str
    steps: list[Step]
    result: AnalysisResult
    errors: list[ApiError] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class Health(BaseModel):
    status: Literal["ok"]
    mode: Literal["live", "mock"]
    anthropic_configured: bool
    tavily_configured: bool


class LlmModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LlmProfile(LlmModel):
    business_name: str
    category: str
    products: list[str]
    value_proposition: str
    value_proposition_basis: str
    target_audience: str
    target_audience_basis: str
    language_code: str
    country_code: str
    country_quote: str


class LlmQueries(LlmModel):
    queries: list[str]


class LlmTriagePick(LlmModel):
    domain: str
    reason: str


class LlmTriage(LlmModel):
    selected: list[LlmTriagePick]


class LlmVerdict(LlmModel):
    domain: str
    name: str
    category: Literal["direct", "indirect", "visual_reference", "not_competitor"]
    why_relevant: str
    quotes: list[str]
    market_status: Literal["confirmed", "unconfirmed", "other_market"]
    market_quote: str
    value_propositions: list[str]
    product_categories: list[str]
    pricing_position: str


class LlmVerification(LlmModel):
    verdicts: list[LlmVerdict]


class LlmClaim(LlmModel):
    text: str
    evidence_ids: list[str]


class LlmPositioning(LlmModel):
    domain: str
    similarities: list[LlmClaim]
    differences: list[LlmClaim]


class LlmVisual(LlmModel):
    domain: str
    similarities: list[LlmClaim]
    differences: list[LlmClaim]
    layout: str


class LlmComparison(LlmModel):
    positioning_summary: str
    own_value_propositions: list[str]
    own_product_categories: list[str]
    own_pricing_position: str
    positioning: list[LlmPositioning]
    visual: list[LlmVisual]


class LlmRecommendation(LlmModel):
    priority: Literal["high", "medium", "low"]
    problem: str
    evidence_ids: list[str]
    opportunity: str
    website_change: str
    example_headline: str
    example_cta: str
    expected_benefit_hypothesis: str
    assumptions: list[str]
    requires: list[Literal["samples", "bundles", "freeShipping"]]


class LlmRecommendations(LlmModel):
    recommendations: list[LlmRecommendation]
