import pickle
import logging
import re
from pathlib import Path
from typing import Dict, Any, List

from config import SCAM_TEXT_MODEL_FILE
from schemas import ScamTextRequest, ScamTextPredictionResponse

logger = logging.getLogger(__name__)


class ScamTextDetector:
    def __init__(self, model_path: Path = SCAM_TEXT_MODEL_FILE):
        self.model_path = model_path
        self.pipeline = None
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
                self.pipeline = pickle.load(f)
            self.is_loaded = True
            logger.info("Scam text NLP pipeline successfully loaded from %s", self.model_path)
        except Exception as e:
            self.load_error = str(e)
            logger.error("Failed to load scam text model: %s", e)

    def predict(self, req: ScamTextRequest) -> ScamTextPredictionResponse:
        if not self.is_loaded or self.pipeline is None:
            raise RuntimeError(f"Scam text model is not loaded: {self.load_error}")

        text = req.text.strip()
        if not text:
            raise ValueError("Input text cannot be blank.")

        pred_class = int(self.pipeline.predict([text])[0])

        prob_scam = None
        prob_legitimate = None
        if hasattr(self.pipeline, "predict_proba"):
            probs = self.pipeline.predict_proba([text])[0]
            prob_legitimate = round(float(probs[0]), 4)
            prob_scam = round(float(probs[1]), 4)

        # Explainable pattern heuristic audit (without claiming fabricated feature importances)
        reason_codes: List[str] = []
        evidence: List[Dict[str, Any]] = []

        lower_text = text.lower()

        # Check for urgency patterns
        if re.search(r"\b(urgent|immediately|within 24 hours|account suspended|locked|blocked)\b", lower_text):
            reason_codes.append("URGENCY_INDUCEMENT")
            evidence.append({
                "category": "psychological_pressure",
                "pattern": "High urgency cues (e.g., immediate action required, suspension threat)",
            })

        # Check for credential or banking requests
        if re.search(r"\b(password|pin|otp|cvv|bank account|verify your wallet|seed phrase|credit card)\b", lower_text):
            reason_codes.append("CREDENTIAL_OR_FINANCIAL_SOLICITATION")
            evidence.append({
                "category": "sensitive_data_harvesting",
                "pattern": "Explicit request for authentication credentials, OTP, or financial details",
            })

        # Check for lottery or prize claims
        if re.search(r"\b(winner|won|lottery|crypto reward|airdrop|claim free|jackpot)\b", lower_text):
            reason_codes.append("UNSOLICITED_REWARD_OR_PRIZE")
            evidence.append({
                "category": "lure",
                "pattern": "Unsolicited reward, lottery, or investment payoff promise",
            })

        # Check for suspicious link prompts
        if re.search(r"(http://|https://|bit\.ly|tinyurl|t\.me|wa\.me|click here|dm us)", lower_text):
            reason_codes.append("EXTERNAL_REDIRECT_PROMPT")
            evidence.append({
                "category": "call_to_action",
                "pattern": "Redirect to external link, URL shortener, or messaging platform",
            })

        # Count message characters, URLs, and identified keywords
        message_length = len(text)
        url_matches = re.findall(r"https?://\S+|www\.\S+|bit\.ly/\S+|t\.me/\S+", text, re.IGNORECASE)
        url_count = len(url_matches)
        scam_keyword_matches = re.findall(
            r"\b(urgent|immediately|suspended|locked|blocked|password|pin|otp|cvv|bank account|verify|winner|won|lottery|reward|crypto|airdrop|jackpot)\b",
            lower_text
        )
        keyword_count = len(scam_keyword_matches)

        label = "Scam" if pred_class == 1 else "Legitimate"

        return ScamTextPredictionResponse(
            predicted_class=pred_class,
            predicted_label=label,
            probability_scam=prob_scam,
            probability_legitimate=prob_legitimate,
            message_length=message_length,
            url_count=url_count,
            keyword_count=keyword_count,
            reason_codes=reason_codes,
            evidence=evidence
        )
