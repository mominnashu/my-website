import fs from "node:fs";

const parseJson = (url) => JSON.parse(fs.readFileSync(url, "utf8").replace(/^\uFEFF/, ""));
const knowledge = parseJson(new URL("../knowledge/platform-knowledge.json", import.meta.url));
const faq = parseJson(new URL("../knowledge/platform-faq.json", import.meta.url));

const languageNames = { en: "English", hi: "हिन्दी", te: "తెలుగు" };
const suggestions = {
  en: ["What can I check?", "Explain the plans", "How does the free trial work?"],
  hi: ["मैं क्या जाँच सकता हूँ?", "प्लान समझाएँ", "मुफ्त ट्रायल कैसे काम करता है?"],
  te: ["నేను ఏమి తనిఖీ చేయగలను?", "ప్లాన్‌లను వివరించండి", "ఉచిత ట్రయల్ ఎలా పనిచేస్తుంది?"],
};

const sensitivePatterns = [
  /\b(password|passcode|otp|token|secret|api[ -]?key|credit card|card number|cvv)\b/i,
  /\b(show|give|reveal|read|fetch|list|access)\b.{0,35}\b(users?|emails?|phone|personal|company records?|reports?|evidence|payments?)\b/i,
  /\b(my|our)\b.{0,25}\b(report|evidence|payment|email|phone|account data|company data)\b/i,
  /(पासवर्ड|ओटीपी|टोकन|निजी विवरण|भुगतान डेटा|कंपनी रिकॉर्ड)/,
  /(పాస్‌వర్డ్|ఓటీపీ|టోకెన్|వ్యక్తిగత వివరాలు|చెల్లింపు డేటా|కంపెనీ రికార్డులు)/,
];

function detectLanguage(message, requested) {
  if (requested && languageNames[requested]) return requested;
  if (/[\u0C00-\u0C7F]/u.test(message)) return "te";
  if (/[\u0900-\u097F]/u.test(message)) return "hi";
  return "en";
}

function scoreIntent(intent, message, language) {
  const normalized = message.toLocaleLowerCase();
  const keywords = [...(intent.keywords[language] || []), ...(intent.keywords.en || [])];
  const genericKeywords = new Set(["what is", "about", "क्या है", "जानकारी", "ఏమిటి", "గురించి"]);
  return keywords.reduce((score, keyword) => {
    const match = normalized.includes(keyword.toLocaleLowerCase());
    const weight = genericKeywords.has(keyword) ? 0.35 : Math.max(1, keyword.length / 5);
    return score + (match ? weight : 0);
  }, 0);
}

export function answerPlatformQuestion(message, requestedLanguage) {
  const language = detectLanguage(message, requestedLanguage);
  const isSensitive = sensitivePatterns.some((pattern) => pattern.test(message));
  const ranked = faq.intents
    .map((intent) => ({ intent, score: scoreIntent(intent, message, language) }))
    .sort((a, b) => b.score - a.score);
  const match = ranked[0]?.score > 0 ? ranked[0].intent : null;

  return {
    answer: isSensitive
      ? faq.sensitive[language]
      : (match?.answer[language] || faq.fallback[language]),
    language,
    languageName: languageNames[language],
    intent: isSensitive ? "sensitive_data_guard" : (match?.id || "fallback"),
    source: "approved_platform_knowledge",
    canSpeak: true,
    suggestions: suggestions[language],
  };
}

export function getPublicAssistantConfig() {
  return {
    product: knowledge.product.name,
    languages: Object.entries(languageNames).map(([code, name]) => ({ code, name })),
    dataPolicy: "Public platform information only. Sensitive account and workspace data is never read.",
  };
}
