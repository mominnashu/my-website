import pytest
from fastapi.testclient import TestClient

import sys
from pathlib import Path

# Add ml-service root to path
service_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(service_root))

from main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "RiskProtect" in data["service"]


def test_models_status():
    response = client.get("/models/status")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "detectors" in data
    assert "fake_profile_classifier" in data["detectors"]
    assert "scam_text_nlp" in data["detectors"]
    assert "phishing_url_classifier" in data["detectors"]
    assert "fake_app_rules_engine" in data["detectors"]

    # Verify fake_profile is loaded and ready
    profile_det = data["detectors"]["fake_profile_classifier"]
    assert profile_det["loaded"] is True
    assert profile_det["features_expected"] == 11


def test_fake_profile_prediction_genuine():
    payload = {
        "profile_pic": 1,
        "nums_length_username": 0.05,
        "fullname_words": 2,
        "nums_length_fullname": 0.0,
        "name_equals_username": 0,
        "description_length": 120,
        "external_url": 1,
        "private": 0,
        "posts": 150,
        "followers": 1200,
        "follows": 350
    }
    response = client.post("/predict/fake-profile", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["detector"] == "fake_profile_classifier"
    assert data["predicted_class"] in [0, 1]
    assert data["predicted_label"] in ["Fake", "Genuine"]
    assert data["probability_genuine"] is not None
    assert data["probability_fake"] is not None


def test_fake_profile_invalid_input():
    # Negative counts or out-of-range ratios should fail validation with 422
    payload = {
        "profile_pic": 2,  # Must be 0 or 1
        "nums_length_username": 1.5,  # Must be <= 1.0
        "fullname_words": -1,  # Must be >= 0
        "nums_length_fullname": 0.0,
        "name_equals_username": 0,
        "description_length": 50,
        "external_url": 0,
        "private": 0,
        "posts": 10,
        "followers": 10,
        "follows": 10
    }
    response = client.post("/predict/fake-profile", json=payload)
    assert response.status_code == 422


def test_scam_text_prediction():
    scam_payload = {
        "text": "Urgent: your account has been locked. Click here to verify your banking details immediately."
    }
    response = client.post("/predict/scam-text", json=scam_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["predicted_class"] == 1
    assert data["predicted_label"] == "Scam"
    assert data["probability_scam"] > 0.5
    assert len(data["reason_codes"]) > 0


def test_legitimate_text_prediction():
    normal_payload = {
        "text": "Hello, thank you for contacting our customer support team today. How may we assist with your order inquiry?"
    }
    response = client.post("/predict/scam-text", json=normal_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["predicted_class"] in [0, 1]
    assert data["probability_legitimate"] is not None


def test_phishing_url_raw_url_prediction():
    # Raw URL now extracts 9 features and predicts using Random Forest
    payload = {"url": "https://secure-login-bank-account.top/update"}
    response = client.post("/predict/phishing-url", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "predicted"
    assert data["predicted_class"] in [0, 1]
    assert data["extracted_features"] is not None
    assert "url_length" in data["extracted_features"]
    assert "suspicious_tld" in data["extracted_features"]


def test_phishing_url_precomputed_features():
    # 9 features: [url_length, num_dots, num_hyphens, num_slashes, num_digits, has_at_symbol, has_ip, suspicious_tld, scam_keywords]
    payload = {
        "precomputed_features": [30.0, 2.0, 1.0, 2.0, 0.0, 0.0, 0.0, 0.0, 0.0]
    }
    response = client.post("/predict/phishing-url", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "predicted"
    assert data["predicted_class"] in [0, 1]


def test_url_rule_analysis_high_risk():
    payload = {
        "url": "http://192.168.1.100/login-portal.top",
        "associated_brand": "PayPal",
        "official_domains": ["paypal.com"]
    }
    response = client.post("/analyze/url-rules", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["risk_score"] >= 60
    assert "IP_ADDRESS_AS_HOST" in data["reason_codes"]
    assert any(code in data["reason_codes"] for code in ["HIGH_RISK_TLD", "HIGH_RISK_TLD_IN_PATH"])


def test_fake_app_analysis_mismatch():
    payload = {
        "app_name": "Flipkart Rewards & Cashback 2026",
        "package_name": "com.flipkart.rewards.cashback",
        "developer_name": "Super Deals Media Group",
        "store_url": "https://apk-free-downloads.xyz/flipkart.apk",
        "associated_brand": "Flipkart",
        "official_packages": ["com.flipkart.android"],
        "official_developers": ["Flipkart India Private Limited"],
        "permissions": [
            "android.permission.RECEIVE_SMS",
            "android.permission.BIND_ACCESSIBILITY_SERVICE"
        ]
    }
    response = client.post("/analyze/fake-app", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["risk_score"] >= 70
    assert data["verdict"] in ["Likely Impersonation", "Suspicious"]
    assert "UNOFFICIAL_PACKAGE_TYPOSQUATTING" in data["reason_codes"]
    assert "UNVERIFIED_DEVELOPER_NAME" in data["reason_codes"]
    assert "HIGH_RISK_PERMISSIONS_REQUESTED" in data["reason_codes"]


def test_fake_app_analysis_legitimate():
    payload = {
        "app_name": "Flipkart Online Shopping App",
        "package_name": "com.flipkart.android",
        "developer_name": "Flipkart India Private Limited",
        "store_url": "https://play.google.com/store/apps/details?id=com.flipkart.android",
        "associated_brand": "Flipkart",
        "official_packages": ["com.flipkart.android"],
        "official_developers": ["Flipkart India Private Limited"],
        "permissions": []
    }
    response = client.post("/analyze/fake-app", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["risk_score"] < 25
    assert data["verdict"] == "Legitimate App"
