from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator, model_validator


# ----------------------------------------------------
# 1. Fake Profile Schemas
# ----------------------------------------------------
class FakeProfileFeatures(BaseModel):
    profile_pic: int = Field(..., ge=0, le=1, description="1 if profile picture present, 0 otherwise")
    nums_length_username: float = Field(..., ge=0.0, le=1.0, description="Ratio of digits in username [0.0 - 1.0]")
    fullname_words: int = Field(..., ge=0, le=50, description="Count of words in full name")
    nums_length_fullname: float = Field(..., ge=0.0, le=1.0, description="Ratio of digits in full name [0.0 - 1.0]")
    name_equals_username: int = Field(..., ge=0, le=1, description="1 if display name == username, 0 otherwise")
    description_length: int = Field(..., ge=0, le=10000, description="Length of bio / description in characters")
    external_url: int = Field(..., ge=0, le=1, description="1 if external URL is present in bio, 0 otherwise")
    private: int = Field(..., ge=0, le=1, description="1 if account is private, 0 otherwise")
    posts: int = Field(..., ge=0, description="Total number of published posts")
    followers: int = Field(..., ge=0, description="Number of followers")
    follows: int = Field(..., ge=0, description="Number of accounts followed")

    @field_validator("nums_length_username", "nums_length_fullname", mode="before")
    @classmethod
    def validate_finite_floats(cls, v: Any) -> float:
        try:
            val = float(v)
            if val != val or abs(val) == float("inf"):
                raise ValueError("Value must be a finite real number.")
            return val
        except (TypeError, ValueError) as err:
            raise ValueError(f"Invalid numeric value: {v}") from err


class FakeProfilePredictionResponse(BaseModel):
    detector: str = "fake_profile_classifier"
    model_type: str = "RandomForestClassifier"
    model_version: str = "1.0.0"
    is_ml_model: bool = True
    predicted_class: int
    predicted_label: str  # "Fake" or "Genuine"
    probability_fake: Optional[float] = None
    probability_genuine: Optional[float] = None
    score_provenance: str = "RandomForest predict_proba on 11 validated numeric features"
    reason_codes: List[str] = Field(default_factory=list)
    evidence: List[Dict[str, Any]] = Field(default_factory=list)
    limitations: str = (
        "Statistical estimate from scikit-learn RandomForest with 200 estimators. "
        "Scores are tree ensemble vote proportions and not calibrated real-world posterior probabilities. "
        "Does not constitute legal or definitive proof of impersonation without analyst corroboration."
    )


# ----------------------------------------------------
# 2. Scam Text Schemas
# ----------------------------------------------------
class ScamTextRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000, description="Suspicious message or bio text")
    reported_account_url: Optional[str] = None
    platform: Optional[str] = None
    associated_brand: Optional[str] = None


class ScamTextPredictionResponse(BaseModel):
    detector: str = "scam_text_nlp"
    model_type: str = "Pipeline(TfidfVectorizer + LogisticRegression)"
    model_version: str = "1.0.0"
    is_ml_model: bool = True
    predicted_class: int
    predicted_label: str  # "Scam" or "Legitimate"
    probability_scam: Optional[float] = None
    probability_legitimate: Optional[float] = None
    message_length: Optional[int] = None
    url_count: Optional[int] = None
    keyword_count: Optional[int] = None
    score_provenance: str = "Pipeline LogisticRegression predict_proba on raw text"
    reason_codes: List[str] = Field(default_factory=list)
    evidence: List[Dict[str, Any]] = Field(default_factory=list)
    limitations: str = (
        "Output is a bag-of-words / TF-IDF logistic regression classifier result. "
        "High scores reflect vocabulary similarity to training scam corpuses (urgency, credential harvesting, wire requests). "
        "Not a feature-level attribution or definitive legal finding."
    )


# ----------------------------------------------------
# 3. Phishing URL Schemas
# ----------------------------------------------------
class PhishingUrlRequest(BaseModel):
    url: Optional[str] = None
    precomputed_features: Optional[List[float]] = Field(
        None,
        description="Optional precomputed 9 features: [url_length, num_dots, num_hyphens, num_slashes, num_digits, has_at_symbol, has_ip, suspicious_tld, scam_keywords]"
    )
    features: Optional[Dict[str, Any]] = None


class PhishingUrlPredictionResponse(BaseModel):
    detector: str = "phishing_url_classifier"
    model_type: str = "RandomForestClassifier"
    model_version: str = "1.0.0"
    is_ml_model: bool = True
    status: str  # "predicted", "available_with_warning", "unavailable"
    message: str
    risk_score: Optional[int] = None
    predicted_class: Optional[int] = None
    predicted_label: Optional[str] = None
    probability_phishing: Optional[float] = None
    probability_legitimate: Optional[float] = None
    extracted_features: Optional[Dict[str, Any]] = None
    score_provenance: Optional[str] = None
    reason_codes: List[str] = Field(default_factory=list)
    evidence: List[Dict[str, Any]] = Field(default_factory=list)
    limitations: str = (
        "Random Forest Classifier trained on 9 lexical and structural features. "
        "Extracts syntactic indicators without initiating active HTTP requests, preserving strict SSRF safety."
    )


class UrlRuleAnalysisRequest(BaseModel):
    url: str = Field(..., min_length=3, max_length=2048)
    associated_brand: Optional[str] = None
    official_domains: Optional[List[str]] = Field(default_factory=list)


class UrlRuleAnalysisResponse(BaseModel):
    detector: str = "url_rules_analyzer"
    is_ml_model: bool = False
    verdict: str  # "High Risk", "Suspicious", "Needs Review", "Low Risk"
    risk_score: int  # 0 - 100
    normalized_url: str
    hostname: str
    findings: List[Dict[str, Any]] = Field(default_factory=list)
    reason_codes: List[str] = Field(default_factory=list)
    limitations: str = (
        "Heuristic rule-based lexical analysis only. No active HTTP requests or network connections "
        "were executed, preserving strict SSRF safety and privacy."
    )


# ----------------------------------------------------
# 4. Fake Mobile Application Engine Schemas
# ----------------------------------------------------
class FakeAppAnalysisRequest(BaseModel):
    app_name: str = Field(..., min_length=1, max_length=256)
    package_name: str = Field(..., min_length=1, max_length=256)
    developer_name: str = Field(..., min_length=1, max_length=256)
    store_url: Optional[str] = None
    associated_brand: Optional[str] = None
    brand_name: Optional[str] = None
    official_package_name: Optional[str] = None
    official_developer_name: Optional[str] = None
    official_packages: Optional[List[str]] = Field(default_factory=list)
    official_developers: Optional[List[str]] = Field(default_factory=list)
    permissions: Optional[List[str]] = Field(default_factory=list)
    store_verified: Optional[bool] = False
    risk_threshold: Optional[int] = 70

    @model_validator(mode="before")
    @classmethod
    def normalize_brand_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            brand = data.get("associated_brand") or data.get("brand_name") or "Flipkart"
            data["associated_brand"] = brand
            data["brand_name"] = brand
        return data


class FakeAppAnalysisResponse(BaseModel):
    detector: str = "fake_app_rules_engine"
    is_ml_model: bool = False
    engine_version: str = "1.0.0"
    risk_score: int  # 0 - 100
    risk_band: str   # "Low", "Medium", "High", "Critical"
    verdict: str     # "Confirmed Impersonation", "Likely Impersonation", "Suspicious", "Legitimate App", "Needs Review"
    brand_matched: str
    rule_results: List[Dict[str, Any]] = Field(default_factory=list)
    reason_codes: List[str] = Field(default_factory=list)
    evidence: List[Dict[str, Any]] = Field(default_factory=list)
    limitations: str = (
        "Deterministic rule-based analysis evaluating package identifier mismatches, "
        "developer name discrepancies, unofficial distribution channels, and sensitive permissions. "
        "This is a rules engine configuration, NOT a statistical machine learning model."
    )


# ----------------------------------------------------
# 5. System and Model Status Schemas
# ----------------------------------------------------
class DetectorStatus(BaseModel):
    name: str
    artifact: str
    type: str  # "ML Model" or "Rules Engine"
    loaded: bool
    version: str
    status: str  # "ready", "degraded", "unavailable"
    details: Optional[str] = None
    features_expected: Optional[int] = None
    feature_names: Optional[List[str]] = None


class SystemStatusResponse(BaseModel):
    service: str = "RiskProtect ML & Rules Service"
    status: str
    detectors: Dict[str, DetectorStatus]
