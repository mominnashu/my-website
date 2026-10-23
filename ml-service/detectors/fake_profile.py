import pickle
import logging
from pathlib import Path
from typing import Tuple, Dict, Any, List
import numpy as np

from config import FAKE_PROFILE_MODEL_FILE
from schemas import FakeProfileFeatures, FakeProfilePredictionResponse

logger = logging.getLogger(__name__)

# Expected feature names in strict order
EXPECTED_FEATURES = [
    "profile pic",
    "nums/length username",
    "fullname words",
    "nums/length fullname",
    "name==username",
    "description length",
    "external URL",
    "private",
    "#posts",
    "#followers",
    "#follows",
]


class FakeProfileDetector:
    def __init__(self, model_path: Path = FAKE_PROFILE_MODEL_FILE):
        self.model_path = model_path
        self.model = None
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
                self.model = pickle.load(f)
            self.is_loaded = True
            logger.info("Fake profile model successfully loaded from %s", self.model_path)
        except Exception as e:
            self.load_error = str(e)
            logger.error("Failed to load fake profile model: %s", e)

    def predict(self, features: FakeProfileFeatures) -> FakeProfilePredictionResponse:
        if not self.is_loaded or self.model is None:
            raise RuntimeError(f"Fake profile model is not loaded: {self.load_error}")

        # Assemble features into exact order
        feature_vector = [
            float(features.profile_pic),
            float(features.nums_length_username),
            float(features.fullname_words),
            float(features.nums_length_fullname),
            float(features.name_equals_username),
            float(features.description_length),
            float(features.external_url),
            float(features.private),
            float(features.posts),
            float(features.followers),
            float(features.follows),
        ]

        # Verify no NaN or Inf
        for idx, val in enumerate(feature_vector):
            if np.isnan(val) or np.isinf(val):
                raise ValueError(f"Feature '{EXPECTED_FEATURES[idx]}' contains invalid value: {val}")

        x = np.array([feature_vector])
        pred_class = int(self.model.predict(x)[0])

        prob_fake = None
        prob_genuine = None
        if hasattr(self.model, "predict_proba"):
            probs = self.model.predict_proba(x)[0]
            # classes_ are [0, 1]
            prob_genuine = round(float(probs[0]), 4)
            prob_fake = round(float(probs[1]), 4)

        reason_codes = []
        evidence = []

        if features.profile_pic == 0:
            reason_codes.append("NO_PROFILE_PICTURE")
            evidence.append({"field": "profile_pic", "value": 0, "assessment": "Default avatar used"})

        if features.nums_length_username > 0.35:
            reason_codes.append("HIGH_NUMERIC_USERNAME_RATIO")
            evidence.append({
                "field": "nums_length_username",
                "value": features.nums_length_username,
                "assessment": f"{round(features.nums_length_username * 100, 1)}% of username consists of numbers (common in automated spam profiles)"
            })

        if features.name_equals_username == 1:
            reason_codes.append("NAME_EQUALS_USERNAME")
            evidence.append({
                "field": "name_equals_username",
                "value": 1,
                "assessment": "Display name is identical to raw handle without personalizing"
            })

        if features.description_length == 0:
            reason_codes.append("EMPTY_BIO")
            evidence.append({"field": "description_length", "value": 0, "assessment": "Zero-length bio"})

        if features.follows > 500 and features.followers < 20:
            reason_codes.append("ASYMMETRIC_FOLLOW_RATIO")
            evidence.append({
                "field": "follow_ratio",
                "value": f"following={features.follows}, followers={features.followers}",
                "assessment": "Excessive following relative to follower audience"
            })

        if features.posts == 0 and features.follows > 100:
            reason_codes.append("ZERO_POSTS_HIGH_ACTIVITY")
            evidence.append({
                "field": "posts",
                "value": 0,
                "assessment": "Account has no organic posts despite active following"
            })

        label = "Fake" if pred_class == 1 else "Genuine"

        return FakeProfilePredictionResponse(
            predicted_class=pred_class,
            predicted_label=label,
            probability_fake=prob_fake,
            probability_genuine=prob_genuine,
            reason_codes=reason_codes,
            evidence=evidence
        )
