import { createWorker } from "tesseract.js";
import { detectionService } from "./detection.service.js";

/**
 * Helper to parse shorthand numbers (e.g. "12.5k" -> 12500, "1.2M" -> 1200000)
 */
function parseShorthandNumber(str) {
  if (!str) return 0;
  const clean = String(str).trim().replace(/,/g, "");
  const match = clean.match(/^([0-9.]+)\s*([kKmMbB])?$/);
  if (!match) {
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : Math.round(num);
  }
  const val = parseFloat(match[1]);
  if (isNaN(val)) return 0;
  const unit = (match[2] || "").toLowerCase();
  if (unit === "k") return Math.round(val * 1000);
  if (unit === "m") return Math.round(val * 1000000);
  if (unit === "b") return Math.round(val * 1000000000);
  return Math.round(val);
}

import axios from "axios";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

/**
 * Perform Vision OCR using OpenAI GPT-4o Vision API
 */
async function recognizeWithOpenAI(imageInput) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  let base64Data = "";
  let mimeType = "image/png";

  if (Buffer.isBuffer(imageInput)) {
    base64Data = imageInput.toString("base64");
  } else if (typeof imageInput === "string") {
    if (imageInput.startsWith("data:")) {
      const match = imageInput.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      } else {
        base64Data = imageInput.split(",")[1] || imageInput;
      }
    } else {
      base64Data = imageInput;
    }
  }

  if (!base64Data) return null;

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all visible text from this image exactly as shown. Return only the raw extracted text without markdown formatting or conversational filler.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Data}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1500,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 25000,
      }
    );

    const extracted = response.data?.choices?.[0]?.message?.content?.trim();
    if (extracted) {
      logger.info("Successfully extracted text using OpenAI GPT-4o Vision OCR");
      return extracted;
    }
  } catch (err) {
    logger.warn(`OpenAI GPT-4o Vision OCR failed, falling back to Tesseract: ${err.response?.data?.error?.message || err.message}`);
  }

  return null;
}

/**
 * Direct GPT-4o Vision Social Profile Feature Extractor
 * Specifically extracts the exact 11 features required by the Random Forest Fake Profile Model:
 * profile_pic, nums_length_username, fullname_words, nums_length_fullname, name_equals_username,
 * description_length, external_url, private, posts, followers, follows + username, fullname
 */
async function extractSocialProfileDirectFromVision(imageInput) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  let base64Data = "";
  let mimeType = "image/png";

  if (Buffer.isBuffer(imageInput)) {
    base64Data = imageInput.toString("base64");
  } else if (typeof imageInput === "string") {
    if (imageInput.startsWith("data:")) {
      const match = imageInput.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      } else {
        base64Data = imageInput.split(",")[1] || imageInput;
      }
    } else {
      base64Data = imageInput;
    }
  }

  if (!base64Data) return null;

  try {
    const prompt = `Analyze this social media profile screenshot (Instagram, Twitter/X, TikTok, LinkedIn, Facebook).
Carefully read the exact profile details visible and return a clean JSON object containing these exact fields:
{
  "username": string (handle without @ symbol, e.g. "elonmusk"),
  "fullname": string (display name above or below handle),
  "profile_pic": integer (1 if profile picture is present/custom photo, 0 if default avatar or empty circle),
  "nums_length_username": float between 0.0 and 1.0 (count of digits in username divided by length of username, e.g. "alex123" has 3 digits / 7 chars = 0.429),
  "fullname_words": integer (number of words in display name, e.g. "Elon Musk" = 2),
  "nums_length_fullname": float between 0.0 and 1.0 (count of digits in display name divided by length of display name),
  "name_equals_username": integer (1 if display name is identical to handle/username ignoring case, 0 otherwise),
  "description_length": integer (character count of bio/biography description text),
  "external_url": integer (1 if an external link/URL is present in bio like bit.ly, linktr.ee, .com, or website, 0 if none),
  "private": integer (1 if profile shows "This Account is Private" or locked padlock, 0 if public),
  "posts": integer (total posts count, e.g. "1.2k" -> 1200, "5" -> 5),
  "followers": integer (total followers count, e.g. "45.2K" -> 45200, "1M" -> 1000000),
  "follows": integer (total following count, e.g. "350" -> 350)
}
Return ONLY valid JSON. No explanations, no markdown ticks.`;

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Data}`,
                },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 800,
        temperature: 0.1,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 25000,
      }
    );

    const jsonStr = response.data?.choices?.[0]?.message?.content?.trim();
    if (jsonStr) {
      const parsed = JSON.parse(jsonStr);
      logger.info(`Extracted 11 exact profile features via GPT-4o Vision for @${parsed.username || "unknown"}`);
      return parsed;
    }
  } catch (err) {
    logger.warn(`GPT-4o Vision direct feature extraction failed, falling back to OCR text parsing: ${err.message}`);
  }

  return null;
}

/**
 * Direct GPT-4o Vision Scam Text Extractor
 */
async function extractScamTextDirectFromVision(imageInput) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  let base64Data = "";
  let mimeType = "image/png";

  if (Buffer.isBuffer(imageInput)) {
    base64Data = imageInput.toString("base64");
  } else if (typeof imageInput === "string") {
    if (imageInput.startsWith("data:")) {
      const match = imageInput.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      } else {
        base64Data = imageInput.split(",")[1] || imageInput;
      }
    } else {
      base64Data = imageInput;
    }
  }

  if (!base64Data) return null;

  try {
    const prompt = `Analyze this image (SMS, WhatsApp message, Telegram chat, or phishing email screenshot).
Extract the core message body and platform.
Return a clean JSON object containing:
{
  "text": string (the exact message or text content visible),
  "platform": string ("sms", "whatsapp", "email", or "general")
}
Return ONLY valid JSON.`;

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 600,
        temperature: 0.1,
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        timeout: 25000,
      }
    );

    const jsonStr = response.data?.choices?.[0]?.message?.content?.trim();
    if (jsonStr) return JSON.parse(jsonStr);
  } catch (err) {
    logger.warn(`GPT-4o Vision scam text extraction failed: ${err.message}`);
  }
  return null;
}

/**
 * Direct GPT-4o Vision Phishing URL Extractor
 */
async function extractUrlDirectFromVision(imageInput) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  let base64Data = "";
  let mimeType = "image/png";

  if (Buffer.isBuffer(imageInput)) {
    base64Data = imageInput.toString("base64");
  } else if (typeof imageInput === "string") {
    if (imageInput.startsWith("data:")) {
      const match = imageInput.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      } else {
        base64Data = imageInput.split(",")[1] || imageInput;
      }
    } else {
      base64Data = imageInput;
    }
  }

  if (!base64Data) return null;

  try {
    const prompt = `Analyze this screenshot showing a browser address bar, QR code, or link in a message.
Extract the exact URL shown.
Return a clean JSON object:
{
  "url": string (full URL including http/https and domain)
}
Return ONLY valid JSON.`;

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 300,
        temperature: 0.1,
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        timeout: 25000,
      }
    );

    const jsonStr = response.data?.choices?.[0]?.message?.content?.trim();
    if (jsonStr) return JSON.parse(jsonStr);
  } catch (err) {
    logger.warn(`GPT-4o Vision URL extraction failed: ${err.message}`);
  }
  return null;
}

/**
 * Direct GPT-4o Vision Fake Mobile App Extractor
 */
async function extractMobileAppDirectFromVision(imageInput) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  let base64Data = "";
  let mimeType = "image/png";

  if (Buffer.isBuffer(imageInput)) {
    base64Data = imageInput.toString("base64");
  } else if (typeof imageInput === "string") {
    if (imageInput.startsWith("data:")) {
      const match = imageInput.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      } else {
        base64Data = imageInput.split(",")[1] || imageInput;
      }
    } else {
      base64Data = imageInput;
    }
  }

  if (!base64Data) return null;

  try {
    const prompt = `Analyze this Google Play Store, APK, or App Store screenshot.
Extract the app metadata and return a clean JSON object:
{
  "app_name": string (app title shown),
  "developer_name": string (developer or offered by name),
  "package_name": string (package name or bundle ID e.g. com.example.app, or synthesize one from the app name like com.appname.app if not visible),
  "brand_name": string (brand being targeted/copied e.g. Flipkart, Amazon, Netflix, SBI, Paytm),
  "store_name": string ("Google Play", "App Store", or "Third Party APK")
}
Return ONLY valid JSON.`;

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 400,
        temperature: 0.1,
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        timeout: 25000,
      }
    );

    const jsonStr = response.data?.choices?.[0]?.message?.content?.trim();
    if (jsonStr) return JSON.parse(jsonStr);
  } catch (err) {
    logger.warn(`GPT-4o Vision Mobile App extraction failed: ${err.message}`);
  }
  return null;
}

/**
 * Unified Server-side OCR engine:
 * 1. Uses OpenAI GPT-4o Vision if OPENAI_API_KEY is configured
 * 2. Seamlessly falls back to local Tesseract.js worker
 */
export async function recognizeImage(imageInput) {
  if (!imageInput) return "";

  // 1. Try OpenAI Vision first if API key configured
  const openAiText = await recognizeWithOpenAI(imageInput);
  if (openAiText) return openAiText;

  // 2. Fallback to Tesseract.js
  let target = imageInput;
  if (typeof imageInput === "string" && imageInput.startsWith("data:")) {
    const parts = imageInput.split(",");
    if (parts.length > 1) {
      target = Buffer.from(parts[1], "base64");
    }
  }

  const worker = await createWorker("eng");
  try {
    const ret = await worker.recognize(target);
    await worker.terminate();
    return (ret.data?.text || "").trim();
  } catch (err) {
    try {
      await worker.terminate();
    } catch {}
    throw new Error(`Server OCR failed: ${err.message}`);
  }
}

/**
 * Heuristic Extractor for Model 1: Fake Social Profile (11 Numeric Features)
 */
export function extractSocialProfileInputs(rawText, brandId = null) {
  const text = rawText || "";
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // 1. Username
  let username = "";
  const handleMatch = text.match(/@([a-zA-Z0-9._]{3,30})/);
  if (handleMatch) {
    username = handleMatch[1];
  } else {
    for (const line of lines.slice(0, 5)) {
      if (/^[a-zA-Z0-9._]{3,25}$/.test(line) && !/followers|following|posts/i.test(line)) {
        username = line;
        break;
      }
    }
  }
  if (!username) username = "detected_account";

  // 2. Full Name
  let fullname = "";
  for (const line of lines.slice(0, 5)) {
    if (line !== username && !line.startsWith("@") && !/followers|following|posts|edit|share|message/i.test(line)) {
      fullname = line;
      break;
    }
  }
  if (!fullname) fullname = username;

  // 3. Counts
  let posts = 0;
  let followers = 0;
  let follows = 0;

  const postsMatch = text.match(/([0-9.,]+[kKmMbB]?)\s*(?:posts?|publications|tweets?)/i);
  if (postsMatch) posts = parseShorthandNumber(postsMatch[1]);

  const followersMatch = text.match(/([0-9.,]+[kKmMbB]?)\s*(?:followers?|abonnés|seguidores)/i);
  if (followersMatch) followers = parseShorthandNumber(followersMatch[1]);

  const followingMatch = text.match(/([0-9.,]+[kKmMbB]?)\s*(?:following|follows?|abonnements|siguiendo)/i);
  if (followingMatch) follows = parseShorthandNumber(followingMatch[1]);

  if (posts === 0 && followers === 0 && follows === 0) {
    for (const line of lines) {
      const parts = line.split(/\s+/).filter((p) => /^[0-9.,]+[kKmMbB]?$/.test(p));
      if (parts.length >= 3) {
        posts = parseShorthandNumber(parts[0]);
        followers = parseShorthandNumber(parts[1]);
        follows = parseShorthandNumber(parts[2]);
        break;
      }
    }
  }

  // 4. External URL
  const urlRegex = /(?:https?:\/\/|www\.|linktr\.ee|bit\.ly|t\.me|bio\.link|wa\.me|[a-zA-Z0-9-]+\.(?:com|org|io|net|xyz|me)\b)/i;
  const external_url = urlRegex.test(text) ? 1 : 0;

  // 5. Private
  const isPrivate = /this account is private|private account|follow to see/i.test(text) ? 1 : 0;

  // 6. Bio / Description
  let bioLines = [];
  let pastHeader = false;
  for (const line of lines) {
    if (/followers|following|posts/i.test(line)) {
      pastHeader = true;
      continue;
    }
    if (pastHeader) {
      if (/follow|message|contact|share profile|edit profile|email/i.test(line)) break;
      bioLines.push(line);
    }
  }
  const description = bioLines.join(" ").trim();
  const description_length = description.length || (text.length > 50 ? Math.min(text.length - 20, 150) : 45);

  // 7. Computed 11 features
  const userDigits = (username.match(/\d/g) || []).length;
  const nums_length_username = parseFloat((userDigits / Math.max(username.length, 1)).toFixed(3));

  const words = fullname.trim().split(/\s+/).filter(Boolean);
  const fullname_words = Math.max(words.length, 1);

  const fullDigits = (fullname.match(/\d/g) || []).length;
  const nums_length_fullname = parseFloat((fullDigits / Math.max(fullname.length, 1)).toFixed(3));

  const name_equals_username = fullname.trim().toLowerCase() === username.trim().toLowerCase() ? 1 : 0;
  const profile_pic = 1;

  return {
    brandId: brandId || undefined,
    platform: "instagram",
    username,
    fullname,
    profile_pic,
    nums_length_username,
    fullname_words,
    nums_length_fullname,
    name_equals_username,
    description_length,
    external_url,
    private: isPrivate,
    posts: posts || 12,
    followers: followers || 450,
    follows: follows || 380,
    notes: `Extracted via RiskProtect Backend OCR (Handle: @${username})`,
  };
}

/**
 * Heuristic Extractor for Model 2: Scam Text NLP (TF-IDF + Logistic Regression)
 */
export function extractScamTextInputs(rawText, brandId = null) {
  const text = (rawText || "").trim();
  let platform = "sms";
  if (/whatsapp/i.test(text)) platform = "whatsapp";
  else if (/telegram/i.test(text)) platform = "whatsapp";
  else if (/dear customer|regards|sincerely/i.test(text)) platform = "email";

  return {
    brandId: brandId || undefined,
    text,
    platform,
    reportedAccountUrl: "",
    notes: "Extracted via RiskProtect Backend OCR Engine",
  };
}

/**
 * Heuristic Extractor for Model 3: Phishing URL (9 Numeric Features)
 */
export function extractUrlInputs(rawText, brandId = null) {
  const text = rawText || "";
  let extractedUrl = "";

  const fullMatch = text.match(/https?:\/\/[^\s"'<>]+/i);
  if (fullMatch) {
    extractedUrl = fullMatch[0];
  } else {
    const domainMatch = text.match(/(?:[a-zA-Z0-9-]+\.)+(?:com|net|org|xyz|top|site|club|online|info|live|cc|pw|co|in|io|app)(?:\/[^\s"'<>]*)?/i);
    if (domainMatch) {
      extractedUrl = `https://${domainMatch[0]}`;
    }
  }

  if (!extractedUrl) {
    const tokenMatch = text.match(/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/);
    if (tokenMatch) extractedUrl = `http://${tokenMatch[0]}`;
  }

  if (!extractedUrl) extractedUrl = "https://suspicious-verify.xyz/login";

  // Calculate the 9 exact features
  const url_length = extractedUrl.length;
  const num_dots = (extractedUrl.match(/\./g) || []).length;
  const num_hyphens = (extractedUrl.match(/-/g) || []).length;
  const num_slashes = (extractedUrl.match(/\//g) || []).length;
  const num_digits = (extractedUrl.match(/\d/g) || []).length;
  const has_at_symbol = extractedUrl.includes("@") ? 1 : 0;
  const has_ip = /(?:https?:\/\/)?(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:\/|$)/.test(extractedUrl) ? 1 : 0;

  const suspiciousTlds = [
    ".xyz", ".top", ".club", ".online", ".site", ".click", ".live",
    ".link", ".pw", ".vip", ".work", ".cc", ".tk", ".ga", ".cf",
    ".gq", ".ml", ".bid", ".loan", ".download", ".buzz"
  ];
  let lower = extractedUrl.toLowerCase();
  const suspicious_tld = suspiciousTlds.some((tld) => lower.includes(tld)) ? 1 : 0;

  const scamKeywords = [
    "login", "verify", "update", "secure", "account", "banking",
    "free", "bonus", "claim", "service", "portal", "signin", "support",
    "wallet", "reward"
  ];
  const scam_keywords = scamKeywords.some((kw) => lower.includes(kw)) ? 1 : 0;

  return {
    brandId: brandId || undefined,
    url: extractedUrl,
    check_rules: true,
    use_ml: true,
    features: {
      url_length,
      num_dots,
      num_hyphens,
      num_slashes,
      num_digits,
      has_at_symbol,
      has_ip,
      suspicious_tld,
      scam_keywords,
    },
  };
}

/**
 * Heuristic Extractor for Model 4: Fake Mobile App (Rules & Cross-Referencing)
 */
export function extractMobileAppInputs(rawText, brandId = null, brandNameHint = null) {
  const text = rawText || "";
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Target Brand
  let brand_name = brandNameHint || "Flipkart";
  const brandKeywords = ["flipkart", "amazon", "paypal", "sbi", "paytm", "netflix", "google", "apple", "hdfc"];
  for (const b of brandKeywords) {
    if (new RegExp(`\\b${b}\\b`, "i").test(text)) {
      brand_name = b.charAt(0).toUpperCase() + b.slice(1);
      break;
    }
  }

  // App Title
  let app_name = "";
  for (const line of lines.slice(0, 4)) {
    if (!/google play|app store|install|download|reviews|contains ads|in-app/i.test(line) && line.length > 2) {
      app_name = line;
      break;
    }
  }
  if (!app_name) app_name = `${brand_name} Deals & Shopping Pro`;

  // Developer Name
  let developer_name = "";
  const devMatch = text.match(/(?:offered by|developer|by)\s*[:\-]?\s*([^\n,]+)/i);
  if (devMatch) {
    developer_name = devMatch[1].trim();
  } else {
    const corpMatch = text.match(/([a-zA-Z0-9\s]+(?:Inc|LLC|Pvt|Private Limited|Ltd|Technologies|Studios|Games|Team))\b/i);
    if (corpMatch) {
      developer_name = corpMatch[1].trim();
    } else {
      developer_name = "Third Party Mobile Studio";
    }
  }

  // Package Name
  let package_name = "";
  const packageMatch = text.match(/\b(com\.[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)\b/);
  if (packageMatch) {
    package_name = packageMatch[1];
  } else {
    const idMatch = text.match(/id=([a-zA-Z0-9_.]+)/);
    if (idMatch) {
      package_name = idMatch[1];
    } else {
      const cleanSlug = app_name.toLowerCase().replace(/[^a-z0-9]/g, "");
      package_name = `com.${brand_name.toLowerCase()}.${cleanSlug.slice(0, 14) || "rewards"}`;
    }
  }

  // Store URL
  let store_url = "";
  const urlMatch = text.match(/https?:\/\/(?:play\.google\.com|apps\.apple\.com|apkpure\.com)[^\s"']+/i);
  if (urlMatch) {
    store_url = urlMatch[0];
  } else {
    store_url = `https://play.google.com/store/apps/details?id=${package_name}`;
  }

  // Official defaults
  let official_package_name = "com.flipkart.android";
  let official_developer_name = "Flipkart India Private Limited";
  if (brand_name.toLowerCase() === "amazon") {
    official_package_name = "in.amazon.mShop.android.shopping";
    official_developer_name = "Amazon Mobile LLC";
  } else if (brand_name.toLowerCase() === "paypal") {
    official_package_name = "com.paypal.android.p2pmobile";
    official_developer_name = "PayPal Mobile";
  } else if (brand_name.toLowerCase() === "sbi") {
    official_package_name = "com.sbi.lotusintouch";
    official_developer_name = "State Bank of India";
  }

  return {
    brandId: brandId || undefined,
    brand_name,
    app_name,
    package_name,
    developer_name,
    store_url,
    official_package_name,
    official_developer_name,
    risk_threshold: 70,
    store_verified: false,
    notes: "Extracted via RiskProtect Backend OCR Engine",
  };
}

/**
 * Auto-detect intent if user chose "auto"
 */
export function detectIntent(rawText) {
  const text = (rawText || "").toLowerCase();
  if (text.startsWith("http") || /https?:\/\//i.test(text) || /\b(?:www\.)[a-z0-9-]+\.[a-z]{2,}/i.test(text)) {
    return "url";
  }
  if (/google play|app store|apk|install\b|contains ads|in-app purchases|offered by|downloads\b|rated for/i.test(text)) {
    return "mobile_app";
  }
  if (/followers?|following|posts?\b|abonn|seguidores|edit profile|share profile|@/i.test(text)) {
    return "social_profile";
  }
  return "scam_text";
}

/**
 * Complete End-to-End Orchestrator:
 * 1. Runs OCR (if image provided) or takes rawText
 * 2. Extracts required inputs for the specified (or auto-detected) model
 * 3. Auto-fills model inputs
 * 4. Runs prediction in the backend
 * 5. Returns autofillInputs and detection results
 */
export async function processOcrAndDetect({ detectorType = "auto", image, ocrText, brandId, brandName, user, extractOnly = false }) {
  let rawText = (ocrText || "").trim();
  if (!rawText && image) {
    rawText = await recognizeImage(image);
  }

  if (!rawText) {
    throw new Error("No readable text could be extracted from image or provided text payload.");
  }

  let finalDetectorType = detectorType;
  if (finalDetectorType === "auto" || !finalDetectorType) {
    finalDetectorType = detectIntent(rawText);
  }

  let autofillInputs = {};
  let detection = null;

  if (finalDetectorType === "social_profile") {
    // If an image is provided, try direct GPT-4o Vision extraction of exact 11 features
    let visionFeatures = null;
    if (image) {
      visionFeatures = await extractSocialProfileDirectFromVision(image);
    }

    if (visionFeatures) {
      autofillInputs = {
        brandId: brandId || undefined,
        platform: "instagram",
        username: visionFeatures.username || "detected_user",
        fullname: visionFeatures.fullname || visionFeatures.username || "Detected Account",
        profile_pic: Number(visionFeatures.profile_pic ?? 1),
        nums_length_username: Number(visionFeatures.nums_length_username ?? 0),
        fullname_words: Number(visionFeatures.fullname_words ?? 1),
        nums_length_fullname: Number(visionFeatures.nums_length_fullname ?? 0),
        name_equals_username: Number(visionFeatures.name_equals_username ?? 0),
        description_length: Number(visionFeatures.description_length ?? 45),
        external_url: Number(visionFeatures.external_url ?? 0),
        private: Number(visionFeatures.private ?? 0),
        posts: Number(visionFeatures.posts ?? 0),
        followers: Number(visionFeatures.followers ?? 0),
        follows: Number(visionFeatures.follows ?? 0),
        notes: `Extracted via RiskProtect GPT-4o Vision (Handle: @${visionFeatures.username || "detected_user"})`,
      };
    } else {
      autofillInputs = extractSocialProfileInputs(rawText, brandId);
    }

    if (!extractOnly) {
      detection = await detectionService.detectSocialProfile(autofillInputs, user);
    }
  } else if (finalDetectorType === "scam_text") {
    let visionData = null;
    if (image) {
      visionData = await extractScamTextDirectFromVision(image);
    }
    if (visionData && visionData.text) {
      autofillInputs = {
        brandId: brandId || undefined,
        text: visionData.text,
        platform: visionData.platform || "sms",
        notes: "Extracted via RiskProtect GPT-4o Vision",
      };
    } else {
      autofillInputs = extractScamTextInputs(rawText, brandId);
    }
    if (!extractOnly) {
      detection = await detectionService.detectScamText(autofillInputs, user);
    }
  } else if (finalDetectorType === "url") {
    let visionData = null;
    if (image) {
      visionData = await extractUrlDirectFromVision(image);
    }
    if (visionData && visionData.url) {
      autofillInputs = extractUrlInputs(visionData.url, brandId);
    } else {
      autofillInputs = extractUrlInputs(rawText, brandId);
    }
    if (!extractOnly) {
      detection = await detectionService.detectUrl(autofillInputs, user);
    }
  } else if (finalDetectorType === "mobile_app") {
    let visionData = null;
    if (image) {
      visionData = await extractMobileAppDirectFromVision(image);
    }
    if (visionData && (visionData.app_name || visionData.package_name)) {
      autofillInputs = {
        brandId: brandId || undefined,
        brand_name: visionData.brand_name || brandName || "Flipkart",
        app_name: visionData.app_name || "Detected Mobile App",
        package_name: visionData.package_name || "com.unverified.application",
        developer_name: visionData.developer_name || "Unknown Developer",
        store_name: visionData.store_name || "Google Play",
        risk_threshold: 70,
        notes: "Extracted via RiskProtect GPT-4o Vision",
      };
    } else {
      autofillInputs = extractMobileAppInputs(rawText, brandId, brandName);
    }
    if (!extractOnly) {
      detection = await detectionService.detectMobileApp(autofillInputs, user);
    }
  } else {
    // Default to scam text
    autofillInputs = extractScamTextInputs(rawText, brandId);
    if (!extractOnly) {
      detection = await detectionService.detectScamText(autofillInputs, user);
    }
  }

  return {
    detectorType: finalDetectorType,
    rawText,
    autofillInputs,
    detection,
  };
}
