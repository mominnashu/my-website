import pickle
import logging
import re
from pathlib import Path
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse
import numpy as np

from config import PHISHING_URL_MODEL_FILE
from schemas import (
    PhishingUrlRequest,
    PhishingUrlPredictionResponse,
    UrlRuleAnalysisRequest,
    UrlRuleAnalysisResponse,
)

logger = logging.getLogger(__name__)

EXPECTED_URL_FEATURES = [
    "url_length",
    "num_dots",
    "num_hyphens",
    "num_slashes",
    "num_digits",
    "has_at_symbol",
    "has_ip",
    "suspicious_tld",
    "scam_keywords",
]

SUSPICIOUS_TLDS = {
    "top", "xyz", "work", "click", "loan", "gq", "cf", "tk", "ml", "ga",
    "buzz", "fit", "surf", "icu", "bar", "rest", "cam", "kim", "party"
}

POPULAR_SHORTENERS = {"bit.ly", "tinyurl.com", "t.co", "is.gd", "buff.ly", "ow.ly", "cutt.ly"}


class UrlAnalyzer:
    def __init__(self, model_path: Path = PHISHING_URL_MODEL_FILE):
        self.model_path = model_path
        self.rf_model = None
        self.is_loaded = False
        self.load_error = None
        self.load_model()

    def load_model(self) -> None:
        try:
            if not self.model_path.exists():
                self.load_error = f"Model artifact not found at {self.model_path}"
                logger.warning(self.load_error)
                return

            with open(self.model_path, "rb") as f:
                self.rf_model = pickle.load(f)
            self.is_loaded = True
            logger.info("Phishing URL model loaded from %s", self.model_path)
        except Exception as e:
            self.load_error = str(e)
            logger.error("Failed to load phishing URL model: %s", e)

    @staticmethod
    def extract_features(raw_url: str) -> Dict[str, Any]:
        url = raw_url.strip()
        url_length = len(url)
        num_dots = url.count(".")
        num_hyphens = url.count("-")
        num_slashes = url.count("/")
        num_digits = sum(c.isdigit() for c in url)
        has_at_symbol = 1 if "@" in url else 0

        parsed = urlparse(url if re.match(r"^https?://", url, re.IGNORECASE) else f"http://{url}")
        hostname = (parsed.hostname or "").lower()

        has_ip = 1 if re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", hostname) else 0

        tld = hostname.split(".")[-1] if "." in hostname else ""
        suspicious_tld = 1 if tld in SUSPICIOUS_TLDS else 0

        keywords = [
            "login", "verify", "account", "secure", "update", "banking",
            "wallet", "unlock", "claim", "bonus", "auth", "signin",
            "password", "support", "service", "helpdesk"
        ]
        url_lower = url.lower()
        scam_keywords = 1 if any(kw in url_lower for kw in keywords) else 0

        return {
            "url_length": url_length,
            "num_dots": num_dots,
            "num_hyphens": num_hyphens,
            "num_slashes": num_slashes,
            "num_digits": num_digits,
            "has_at_symbol": has_at_symbol,
            "has_ip": has_ip,
            "suspicious_tld": suspicious_tld,
            "scam_keywords": scam_keywords,
        }

    def predict_ml(self, req: PhishingUrlRequest) -> PhishingUrlPredictionResponse:
        """
        ML prediction endpoint handler evaluating RandomForestClassifier on 9 features:
        [url_length, num_dots, num_hyphens, num_slashes, num_digits, has_at_symbol, has_ip, suspicious_tld, scam_keywords]
        """
        if not self.is_loaded or self.rf_model is None:
            return PhishingUrlPredictionResponse(
                status="unavailable",
                message=f"Phishing URL model is not loaded: {self.load_error}",
                predicted_class=None,
                reason_codes=["MODEL_ARTIFACT_UNAVAILABLE"]
            )

        extracted_feats = {}
        feature_vector = None

        if req.precomputed_features is not None:
            if len(req.precomputed_features) != 9:
                return PhishingUrlPredictionResponse(
                    status="invalid_features",
                    message=f"Expected exactly 9 numeric features, received {len(req.precomputed_features)}",
                    predicted_class=None,
                    reason_codes=["FEATURE_DIMENSION_MISMATCH"]
                )
            feature_vector = [float(v) for v in req.precomputed_features]
            extracted_feats = {name: feature_vector[i] for i, name in enumerate(EXPECTED_URL_FEATURES)}
        elif req.features is not None:
            extracted_feats = req.features
            feature_vector = [float(req.features.get(k, 0)) for k in EXPECTED_URL_FEATURES]
        elif req.url:
            extracted_feats = self.extract_features(req.url)
            feature_vector = [float(extracted_feats[k]) for k in EXPECTED_URL_FEATURES]
        else:
            return PhishingUrlPredictionResponse(
                status="missing_input",
                message="Provide either a target 'url' or precomputed 9-feature vector.",
                predicted_class=None,
                reason_codes=["NO_INPUT_PROVIDED"]
            )

        x = np.array([feature_vector])
        pred_class = int(self.rf_model.predict(x)[0])
        probs = self.rf_model.predict_proba(x)[0]
        prob_legit = round(float(probs[0]), 4)
        prob_phishing = round(float(probs[1]), 4)
        label = "Phishing" if pred_class == 1 else "Legitimate"
        risk_score = int(round(prob_phishing * 100))

        reason_codes = []
        evidence = []

        if extracted_feats.get("has_ip", 0) == 1:
            reason_codes.append("IP_HOST_DETECTED")
            evidence.append({"field": "has_ip", "finding": "URL uses direct IP instead of registered domain"})
        if extracted_feats.get("has_at_symbol", 0) == 1:
            reason_codes.append("AT_SYMBOL_OBFUSCATION")
            evidence.append({"field": "has_at_symbol", "finding": "URL contains '@' userinfo credential trick"})
        if extracted_feats.get("suspicious_tld", 0) == 1:
            reason_codes.append("SUSPICIOUS_TLD")
            evidence.append({"field": "suspicious_tld", "finding": "High-abuse TLD registered"})
        if extracted_feats.get("scam_keywords", 0) == 1:
            reason_codes.append("SCAM_LURE_KEYWORDS")
            evidence.append({"field": "scam_keywords", "finding": "Authentication or financial lure keywords found in URL path"})
        if extracted_feats.get("num_dots", 0) >= 3:
            reason_codes.append("EXCESSIVE_SUBDOMAINS")
            evidence.append({"field": "num_dots", "finding": f"High number of dots ({extracted_feats.get('num_dots')}) indicating multi-level subdomains"})

        return PhishingUrlPredictionResponse(
            status="predicted",
            message="Prediction generated using RandomForestClassifier on 9 numeric features.",
            risk_score=risk_score,
            predicted_class=pred_class,
            predicted_label=label,
            probability_phishing=prob_phishing,
            probability_legitimate=prob_legit,
            extracted_features=extracted_feats,
            score_provenance="RandomForest predict_proba on 9 syntactic URL features",
            reason_codes=reason_codes,
            evidence=evidence
        )

    def analyze_rules(self, req: UrlRuleAnalysisRequest) -> UrlRuleAnalysisResponse:
        """
        Deterministic, safe, rule-based URL analysis.
        Operates entirely offline on URL syntax and lexical tokens without making outbound HTTP requests (SSRF-safe).
        """
        raw_url = req.url.strip()
        if not re.match(r"^https?://", raw_url, re.IGNORECASE):
            normalized = f"http://{raw_url}"
        else:
            normalized = raw_url

        try:
            parsed = urlparse(normalized)
            hostname = parsed.hostname or ""
        except Exception:
            hostname = ""

        findings: List[Dict[str, Any]] = []
        reason_codes: List[str] = []
        base_risk = 5

        # 1. IP hostname check
        is_ip = bool(re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", hostname))
        if is_ip:
            base_risk += 45
            reason_codes.append("IP_ADDRESS_AS_HOST")
            findings.append({
                "rule": "ip_address_host",
                "severity": "HIGH",
                "detail": f"Direct IP address '{hostname}' used instead of registered domain name"
            })

        # 2. At-symbol check (browser credential hiding trick)
        if "@" in raw_url:
            base_risk += 40
            reason_codes.append("AT_SYMBOL_OBFUSCATION")
            findings.append({
                "rule": "at_symbol",
                "severity": "HIGH",
                "detail": "@ symbol in URL can trick users by hiding true destination host"
            })

        # 3. Excessive subdomains
        domain_parts = hostname.split(".")
        if len(domain_parts) > 4:
            base_risk += 20
            reason_codes.append("EXCESSIVE_SUBDOMAINS")
            findings.append({
                "rule": "subdomain_depth",
                "severity": "MEDIUM",
                "detail": f"Domain has {len(domain_parts)} parts; attackers frequently nest deep subdomains"
            })

        # 4. Suspicious TLD (checked in hostname or embedded in fake path)
        tld = domain_parts[-1].lower() if domain_parts else ""
        if tld in SUSPICIOUS_TLDS:
            base_risk += 25
            reason_codes.append("HIGH_RISK_TLD")
            findings.append({
                "rule": "suspicious_tld",
                "severity": "MEDIUM",
                "detail": f"Top-level domain '.{tld}' is disproportionately abused in phishing and malware campaigns"
            })
        elif any(f".{stld}" in raw_url.lower() for stld in SUSPICIOUS_TLDS):
            base_risk += 20
            reason_codes.append("HIGH_RISK_TLD_IN_PATH")
            findings.append({
                "rule": "suspicious_tld_in_path",
                "severity": "MEDIUM",
                "detail": "High-risk TLD string embedded in URL path to simulate a foreign deceptive domain"
            })

        # 5. URL Shortener
        if hostname.lower() in POPULAR_SHORTENERS:
            base_risk += 20
            reason_codes.append("URL_SHORTENER_DETECTED")
            findings.append({
                "rule": "url_shortener",
                "severity": "MEDIUM",
                "detail": f"Host '{hostname}' is a URL shortener which conceals final destination"
            })

        # 6. Excessive hyphens in domain
        hyphen_count = hostname.count("-")
        if hyphen_count >= 2:
            base_risk += 15
            reason_codes.append("EXCESSIVE_HYPHENS_IN_DOMAIN")
            findings.append({
                "rule": "domain_hyphens",
                "severity": "LOW",
                "detail": f"Hostname contains {hyphen_count} hyphens, often used in typosquatting"
            })

        # 7. Brand impersonation / typosquatting check (in hostname or deceptive path)
        if req.associated_brand:
            brand_token = re.sub(r"[^a-zA-Z0-9]", "", req.associated_brand.lower())
            if brand_token and len(brand_token) >= 3:
                # Check if brand appears in hostname/url but domain is not an official domain
                is_official = False
                for off in req.official_domains:
                    clean_off = off.lower().replace("https://", "").replace("http://", "").strip("/")
                    if hostname.lower() == clean_off or hostname.lower().endswith("." + clean_off):
                        is_official = True
                        break

                if not is_official and brand_token in raw_url.lower():
                    base_risk += 35
                    reason_codes.append("BRAND_IMPERSONATION_SUSPECTED")
                    findings.append({
                        "rule": "brand_in_unauthorized_url",
                        "severity": "CRITICAL",
                        "detail": f"Brand '{req.associated_brand}' appears in unauthorized URL '{raw_url}'"
                    })

        risk_score = min(max(base_risk, 0), 100)

        if risk_score >= 70:
            verdict = "High Risk"
        elif risk_score >= 45:
            verdict = "Suspicious"
        elif risk_score >= 25:
            verdict = "Needs Review"
        else:
            verdict = "Low Risk"

        return UrlRuleAnalysisResponse(
            verdict=verdict,
            risk_score=risk_score,
            normalized_url=normalized,
            hostname=hostname,
            findings=findings,
            reason_codes=reason_codes
        )
