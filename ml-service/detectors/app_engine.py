import pickle
import logging
import re
from pathlib import Path
from typing import Dict, Any, List

from config import FAKE_APP_ENGINE_FILE
from schemas import FakeAppAnalysisRequest, FakeAppAnalysisResponse

logger = logging.getLogger(__name__)

DANGEROUS_PERMISSIONS = {
    "android.permission.BIND_ACCESSIBILITY_SERVICE": "Can intercept screen, steal 2FA codes, and click buttons without user awareness",
    "android.permission.SYSTEM_ALERT_WINDOW": "Allows overlaying fake login windows over legitimate apps",
    "android.permission.RECEIVE_SMS": "Can read incoming banking OTPs",
    "android.permission.READ_SMS": "Can read stored SMS messages including financial transactions",
    "android.permission.REQUEST_INSTALL_PACKAGES": "Can download and install secondary malicious payloads",
    "android.permission.RECORD_AUDIO": "Can record ambient microphone audio",
    "android.permission.READ_PHONE_STATE": "Harvests IMEI, SIM serials, and device identifiers",
}

LEGIT_STORES = [
    "play.google.com",
    "apps.apple.com",
    "amazon.com/appstore",
    "galaxystore.samsung.com"
]


class FakeAppEngine:
    def __init__(self, config_path: Path = FAKE_APP_ENGINE_FILE):
        self.config_path = config_path
        self.default_config: Dict[str, Any] = {}
        self.is_loaded = False
        self.load_error = None
        self.load_config()

    def load_config(self) -> None:
        try:
            if not self.config_path.exists():
                self.load_error = f"Engine config artifact not found at {self.config_path}"
                logger.warning(self.load_error)
                return

            with open(self.config_path, "rb") as f:
                data = pickle.load(f)
                if isinstance(data, dict):
                    self.default_config = data
                    self.is_loaded = True
                    logger.info("Fake app rules engine loaded config: %s", data)
                else:
                    self.load_error = f"Expected dict in engine pickle, got {type(data)}"
                    logger.warning(self.load_error)
        except Exception as e:
            self.load_error = str(e)
            logger.error("Failed to load fake app engine config: %s", e)

    def analyze(self, req: FakeAppAnalysisRequest) -> FakeAppAnalysisResponse:
        brand = req.associated_brand.strip()
        package = req.package_name.strip()
        developer = req.developer_name.strip()
        app_name = req.app_name.strip()

        # Merge official package names: from request or fallback to default config if matching brand
        official_packages = [p.lower() for p in (req.official_packages or [])]
        if req.official_package_name:
            official_packages.append(req.official_package_name.strip().lower())

        official_devs = [d.lower() for d in (req.official_developers or [])]
        if req.official_developer_name:
            official_devs.append(req.official_developer_name.strip().lower())

        risk_threshold = req.risk_threshold or self.default_config.get("risk_threshold", 70)

        if not official_packages and self.default_config:
            if brand.lower() == self.default_config.get("official_brand", "").lower():
                official_packages.append(self.default_config.get("official_package", "").lower())
                official_devs.append(self.default_config.get("official_developer", "").lower())

        risk_score = 10
        rule_results: List[Dict[str, Any]] = []
        reason_codes: List[str] = []
        evidence: List[Dict[str, Any]] = []

        # 1. Package Name Matching
        lower_pkg = package.lower()
        exact_package_match = lower_pkg in official_packages if official_packages else False

        if exact_package_match:
            # Matches official package
            rule_results.append({
                "rule": "package_identifier_check",
                "status": "PASS",
                "detail": f"Package '{package}' exactly matches official brand package."
            })
        elif official_packages:
            # Package does not match official list
            # Check for typosquatting / prefix impersonation
            brand_slug = re.sub(r"[^a-z0-9]", "", brand.lower())
            is_impersonating_name = brand_slug in lower_pkg

            if is_impersonating_name:
                risk_score += 45
                reason_codes.append("UNOFFICIAL_PACKAGE_TYPOSQUATTING")
                rule_results.append({
                    "rule": "package_identifier_check",
                    "status": "FAIL",
                    "detail": f"Package '{package}' incorporates brand name '{brand}' but is NOT in official packages {official_packages}."
                })
                evidence.append({
                    "type": "package_mismatch",
                    "submitted": package,
                    "official_known": official_packages,
                    "finding": "App uses brand name in package identifier to masquerade as official app"
                })
            else:
                risk_score += 25
                reason_codes.append("PACKAGE_MISMATCH")
                rule_results.append({
                    "rule": "package_identifier_check",
                    "status": "WARN",
                    "detail": f"Package '{package}' does not match registered official packages."
                })
        else:
            rule_results.append({
                "rule": "package_identifier_check",
                "status": "INFO",
                "detail": f"No official packages registered for brand '{brand}' to cross-reference."
            })

        # 2. Developer Name Verification
        lower_dev = developer.lower()
        exact_dev_match = any(lower_dev == d for d in official_devs) if official_devs else False

        if exact_dev_match:
            rule_results.append({
                "rule": "developer_identity_check",
                "status": "PASS",
                "detail": f"Developer '{developer}' matches verified brand publisher."
            })
        elif official_devs:
            risk_score += 30
            reason_codes.append("UNVERIFIED_DEVELOPER_NAME")
            rule_results.append({
                "rule": "developer_identity_check",
                "status": "FAIL",
                "detail": f"Developer '{developer}' does not match official publisher names {official_devs}."
            })
            evidence.append({
                "type": "developer_mismatch",
                "submitted": developer,
                "official_known": official_devs,
                "finding": "App published by an unverified third party entity"
            })

        # 3. Store Source Distribution Check
        store_url = (req.store_url or "").lower()
        if store_url:
            is_legit_store = any(store in store_url for store in LEGIT_STORES)
            if not is_legit_store:
                risk_score += 20
                reason_codes.append("UNOFFICIAL_APP_STORE_DISTRIBUTION")
                rule_results.append({
                    "rule": "distribution_channel_check",
                    "status": "WARN",
                    "detail": f"App is distributed via unofficial channel: '{req.store_url}' (not Google Play or Apple App Store)."
                })
                evidence.append({
                    "type": "untrusted_distribution",
                    "url": req.store_url,
                    "finding": "Sideloading or unverified third-party APK hosting site"
                })
            else:
                rule_results.append({
                    "rule": "distribution_channel_check",
                    "status": "PASS",
                    "detail": "App distributed via reputable official application store."
                })

        # 4. Dangerous Android Permissions Check
        if req.permissions:
            detected_dangerous = []
            for perm in req.permissions:
                for dangerous_key, desc in DANGEROUS_PERMISSIONS.items():
                    if dangerous_key.lower() in perm.lower():
                        detected_dangerous.append({"permission": perm, "risk": desc})
                        break

            if detected_dangerous:
                risk_score += min(len(detected_dangerous) * 10, 25)
                reason_codes.append("HIGH_RISK_PERMISSIONS_REQUESTED")
                rule_results.append({
                    "rule": "permissions_security_audit",
                    "status": "FAIL",
                    "detail": f"App requests {len(detected_dangerous)} high-risk Android permissions."
                })
                evidence.append({
                    "type": "permissions_risk",
                    "items": detected_dangerous,
                    "finding": "App requests intrusive permissions commonly abused by banking trojans and spy apps"
                })

        # Bound risk score
        risk_score = min(max(risk_score, 0), 100)

        # Verdict and Band determination
        if risk_score >= 80:
            risk_band = "Critical"
            verdict = "Likely Impersonation"
        elif risk_score >= 60:
            risk_band = "High"
            verdict = "Suspicious"
        elif risk_score >= 35:
            risk_band = "Medium"
            verdict = "Needs Review"
        else:
            risk_band = "Low"
            verdict = "Legitimate App"

        # If it exactly matches package and developer, mark as Legitimate
        if exact_package_match and exact_dev_match:
            risk_score = 5
            risk_band = "Low"
            verdict = "Legitimate App"
            reason_codes = ["OFFICIAL_PACKAGE_AND_DEVELOPER_MATCH"]

        return FakeAppAnalysisResponse(
            risk_score=risk_score,
            risk_band=risk_band,
            verdict=verdict,
            brand_matched=brand,
            rule_results=rule_results,
            reason_codes=reason_codes,
            evidence=evidence
        )
