# RiskProtect MVP — Enterprise Digital Risk Protection Platform

A full-stack, enterprise-grade Digital Risk Protection (DRP) and Threat Intelligence SOC suite designed to detect impersonation attacks, rogue mobile applications, phishing domains, brand infringement, and scam campaigns.

The original static page, `Scam Shield_ is this link or message safe_ (2).html`, remains in the repository alongside the RiskProtect application.

---

## 🌟 Architecture & Active Ports

| Service | Technology | Port | Documentation / Entry |
|---|---|---|---|
| **Python ML Engine** | FastAPI, scikit-learn, joblib | `8001` | `http://127.0.0.1:8001/docs` (Swagger UI) |
| **Backend REST API** | Node.js, Express, Zod, JWT | `5000` | `http://127.0.0.1:5000/api/v1/system/health` |
| **Enterprise Frontend** | Vite, React, Vanilla CSS, Tesseract.js | `5173` | `http://127.0.0.1:5173/` |

---

## 🚀 One-Click Startup

To start all 3 services simultaneously in separate Windows command windows:
```bat
start_all.bat
```

Or start each manually:
1. **ML Service**:
   ```bash
   cd ml-service
   python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
   ```
2. **Backend**:
   ```bash
   cd backend
   npm run dev
   ```
3. **Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

---

## 🛡️ Key Features & Threat Engines

1. **Social Profile Impersonation Detector**:
   - Random Forest model evaluating follower ratios, username distance, verified statuses, bio keywords, and behavioral anomalies.
2. **Brand Page Infringement Heuristics**:
   - Normalized Levenshtein distance, favicon/logo similarity index, keywords, and domain registration age.
3. **Scam Text NLP Engine**:
   - TF-IDF + Logistic Regression/RF pipeline detecting urgency triggers, payment/crypto scams, and account takeover phishing.
4. **Interactive In-Browser OCR Scanner**:
   - Powered by `tesseract.js` in the frontend. Drag-and-drop any screenshot, extract text instantly with client-side OCR, and pass it directly to the Scam NLP Engine for real-time scoring.
5. **Rogue Mobile Application Engine**:
   - Detects fake APKs and unauthorized apps using fuzzy package matching, developer name scrutiny, permission analysis, and download discrepancy heuristics.
6. **Phishing URL Classifier**:
   - Feature extractor evaluating Shannon entropy, top-level domain risk, IP addresses in hostnames, special character counts, and keyword traps.
7. **SOC Alert Triage & Case Management**:
   - Full lifecycle management: ingest detection, calculate automated severity (Critical, High, Medium, Low), acknowledge alerts, escalate to investigations, add timeline notes, and resolve cases.
8. **Brand Asset Registry**:
   - Monitor and configure official domains, social handles, and app package names for target organizations.

---

## 🎨 Enterprise White Theme Design System

- **Typography**: Google Font **Plus Jakarta Sans** for crisp, modern legibility; **JetBrains Mono** for model metrics, URLs, and telemetry data.
- **Color Palette**: High-contrast pure white (`#ffffff`) surfaces, subtle slate borderings (`#e2e8f0`), deep slate typography (`#0f172a`), and color-coded risk pills (Red `#fee2e2`, Orange `#ffedd5`, Amber `#fef3c7`, Green `#ecfdf5`).
- **Layout**: Clean executive KPI metrics cards, responsive sidebar navigation, interactive dropzones, and real-time status telemetry indicators.

---

## 🧪 Testing

- **Python ML Test Suite**:
  ```bash
  cd ml-service
  pytest tests/test_ml_service.py -v
  ```
  *(11/11 tests passing)*

- **Backend Integration Test Suite**:
  ```bash
  cd backend
  npm test
  ```
  *(15/15 tests passing)*

## Company SaaS workflow

The public landing page is shown to signed-out visitors. Register a company, sign in,
add official brand assets in Brand Registry, then open Threat scanners. Each service
accepts PNG/JPEG/WebP screenshots up to 15 MB and states its evidence requirements.
Extraction and inference run on the backend; the new scan API returns a prediction
summary rather than raw OCR text or feature vectors. Unreadable or incomplete evidence
requires a clearer upload. Predictions support human investigation and are not proof
of fraud. Screenshots are processed in memory, not retained as report attachments.

Company users can report a saved prediction to the product owner. Reports are stored
in MongoDB with the company and submitting user. The owner can filter by company,
reply, mark reviewing, and resolve; companies can see their own report status and reply.
The report and company directory lists currently show the latest 200 entries.

Public registration creates a company admin, never a product owner. To set up the
owner, register the intended account first, then an operator runs from backend/:

    node scripts/promote-owner.js owner@example.com

Replace the email with the intended registered account, then sign out and back in.
The super_admin role opens the separate product-owner dashboard. No existing account
is automatically promoted and no default owner password is created.
Authenticated workspaces require a live database connection and fail closed if it is
unavailable. The old technical detector component remains in source, but the customer
workspace uses the evidence upload interface. Existing detection endpoints and ML model
files remain available; the new workflow adds backend validation and reporting routes.
