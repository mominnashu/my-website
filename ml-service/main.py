import logging
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from config import (
    HOST,
    PORT,
    LOG_LEVEL,
    FAKE_PROFILE_MODEL_FILE,
    SCAM_TEXT_MODEL_FILE,
    PHISHING_URL_MODEL_FILE,
    FAKE_APP_ENGINE_FILE,
)
from schemas import (
    FakeProfileFeatures,
    FakeProfilePredictionResponse,
    ScamTextRequest,
    ScamTextPredictionResponse,
    PhishingUrlRequest,
    PhishingUrlPredictionResponse,
    UrlRuleAnalysisRequest,
    UrlRuleAnalysisResponse,
    FakeAppAnalysisRequest,
    FakeAppAnalysisResponse,
    SystemStatusResponse,
    DetectorStatus,
)
from detectors.fake_profile import FakeProfileDetector, EXPECTED_FEATURES
from detectors.scam_text import ScamTextDetector
from detectors.url_analyzer import UrlAnalyzer
from detectors.app_engine import FakeAppEngine

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("riskprotect-ml")

app = FastAPI(
    title="RiskProtect ML & Rules Service",
    description="Machine Learning and Deterministic Threat Rules Engine for Digital Risk Protection",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instantiate detector engines
profile_detector = FakeProfileDetector(FAKE_PROFILE_MODEL_FILE)
scam_detector = ScamTextDetector(SCAM_TEXT_MODEL_FILE)
url_analyzer = UrlAnalyzer(PHISHING_URL_MODEL_FILE)
app_engine = FakeAppEngine(FAKE_APP_ENGINE_FILE)


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "RiskProtect ML & Threat Intelligence Service",
        "version": "1.0.0",
    }


@app.get("/models/status", response_model=SystemStatusResponse)
def models_status():
    detectors = {
        "fake_profile_classifier": DetectorStatus(
            name="Fake Profile Random Forest Classifier",
            artifact=FAKE_PROFILE_MODEL_FILE.name,
            type="ML Model",
            loaded=profile_detector.is_loaded,
            version="1.0.0",
            status="ready" if profile_detector.is_loaded else "unavailable",
            details="200-estimator RandomForest expecting 11 normalized numeric features in fixed order",
            features_expected=11,
            feature_names=EXPECTED_FEATURES,
        ),
        "scam_text_nlp": DetectorStatus(
            name="Scam Text NLP Pipeline",
            artifact=SCAM_TEXT_MODEL_FILE.name,
            type="ML Model",
            loaded=scam_detector.is_loaded,
            version="1.0.0",
            status="ready" if scam_detector.is_loaded else "unavailable",
            details="Pipeline(TfidfVectorizer + LogisticRegression) for message and bio text classification",
        ),
        "phishing_url_classifier": DetectorStatus(
            name="Phishing URL Random Forest Classifier",
            artifact=PHISHING_URL_MODEL_FILE.name,
            type="ML Model",
            loaded=url_analyzer.is_loaded,
            version="1.0.0",
            status="degraded",
            details=(
                "Model artifact is loaded, but raw URL inference is marked unavailable because original "
                "training dictionaries (suspicious_tld and scam_keywords) are missing. Precomputed 9-feature vectors are supported."
            ),
            features_expected=9,
        ),
        "url_rules_analyzer": DetectorStatus(
            name="Rule-based SSRF-Safe URL Analyzer",
            artifact="built-in-rules",
            type="Rules Engine",
            loaded=True,
            version="1.0.0",
            status="ready",
            details="Deterministic lexical URL inspector evaluating IP hosts, deep subdomains, brand typosquatting, and risky TLDs",
        ),
        "fake_app_rules_engine": DetectorStatus(
            name="Mobile Application Impersonation Rules Engine",
            artifact=FAKE_APP_ENGINE_FILE.name,
            type="Rules Engine",
            loaded=app_engine.is_loaded,
            version="1.0.0",
            status="ready" if app_engine.is_loaded else "degraded",
            details="Rule-based matching against registered official package names, developer names, permissions, and app stores",
        ),
    }

    all_ready = profile_detector.is_loaded and scam_detector.is_loaded
    overall_status = "operational" if all_ready else "degraded"

    return SystemStatusResponse(
        status=overall_status,
        detectors=detectors,
    )


@app.post("/predict/fake-profile", response_model=FakeProfilePredictionResponse)
def predict_fake_profile(features: FakeProfileFeatures):
    try:
        return profile_detector.predict(features)
    except Exception as e:
        logger.exception("Error in fake profile prediction: %s", e)
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/predict/scam-text", response_model=ScamTextPredictionResponse)
def predict_scam_text(req: ScamTextRequest):
    try:
        return scam_detector.predict(req)
    except Exception as e:
        logger.exception("Error in scam text prediction: %s", e)
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/predict/phishing-url", response_model=PhishingUrlPredictionResponse)
def predict_phishing_url(req: PhishingUrlRequest):
    try:
        return url_analyzer.predict_ml(req)
    except Exception as e:
        logger.exception("Error in phishing url prediction: %s", e)
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/analyze/url-rules", response_model=UrlRuleAnalysisResponse)
def analyze_url_rules(req: UrlRuleAnalysisRequest):
    try:
        return url_analyzer.analyze_rules(req)
    except Exception as e:
        logger.exception("Error in url rule analysis: %s", e)
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/analyze/fake-app", response_model=FakeAppAnalysisResponse)
def analyze_fake_app(req: FakeAppAnalysisRequest):
    try:
        return app_engine.analyze(req)
    except Exception as e:
        logger.exception("Error in fake app analysis: %s", e)
        raise HTTPException(status_code=400, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=False)
