export const USER_ROLES = ["super_admin", "admin", "analyst", "viewer"];

export const DETECTOR_TYPES = [
  "social_profile",
  "brand_page",
  "scam_text",
  "mobile_app",
  "url",
];

export const DETECTION_VERDICTS = [
  "Fake Profile",
  "Real / Genuine Profile",
  "Confirmed Impersonation",
  "Likely Impersonation",
  "Likely Impersonator",
  "Likely Authentic",
  "Confirmed Scam / Phishing",
  "Legitimate Message",
  "Phishing URL",
  "Legitimate URL",
  "High Risk",
  "Low Risk",
  "Suspicious",
  "Needs Review",
  "No Issue Detected",
  "Legitimate App",
  "Detector Unavailable",
];

export const RISK_BANDS = ["Low", "Medium", "High", "Critical"];

export const ALERT_SEVERITIES = ["low", "medium", "high", "critical"];

export const ALERT_STATUSES = [
  "new",
  "acknowledged",
  "investigating",
  "dismissed",
  "escalated",
  "resolved",
];

export const CASE_STATUSES = [
  "open",
  "investigating",
  "escalated",
  "resolved",
  "closed",
];

export const AUDIT_ACTIONS = [
  "USER_LOGIN",
  "USER_REGISTER",
  "ORGANIZATION_CREATE",
  "BRAND_CREATE",
  "BRAND_UPDATE",
  "BRAND_DELETE",
  "DETECTION_RUN",
  "DETECTION_RUN_OCR",
  "ALERT_ACKNOWLEDGE",
  "ALERT_STATUS_UPDATE",
  "CASE_CREATE",
  "CASE_UPDATE",
  "CASE_NOTE_ADD",
  "DETECTION_ATTACH_CASE",
  "SUBSCRIPTION_CHANGED",
  "COMPANY_UPDATED",
  "REPORT_CREATE",
  "REPORT_STATUS_UPDATE",
  "REPORT_AUTO_REVIEW",
];
