import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = Path(os.getenv("MODEL_DIR", BASE_DIR / "models"))

HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", 8001))
LOG_LEVEL = os.getenv("LOG_LEVEL", "info")

# Artifact filenames
FAKE_PROFILE_MODEL_FILE = MODEL_DIR / "fake_profile_rf.pkl"
SCAM_TEXT_MODEL_FILE = MODEL_DIR / "scam_text_nlp.pkl"
PHISHING_URL_MODEL_FILE = MODEL_DIR / "phishing_url_rf.pkl"
FAKE_APP_ENGINE_FILE = MODEL_DIR / "fake_app_engine.pkl"
