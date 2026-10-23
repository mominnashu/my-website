import { createWorker } from 'tesseract.js';

/**
 * Optical Character Recognition (OCR) Engine
 * Processes screenshot evidence, extracts textual threats, and prepares them for:
 * 1. Social Profile Detector (11 features)
 * 2. Scam text screening
 * 3. Phishing URL Detector (9 features)
 * 4. Fake Mobile App Detector (Rules Engine)
 */
export async function recognizeImageText(imageFileOrUrl, onProgress = () => {}) {
  try {
    onProgress({ status: 'Initializing OCR Worker Engine...', progress: 0.1 });
    const worker = await createWorker('eng');

    onProgress({ status: 'Processing and analyzing image bitmap...', progress: 0.4 });
    const result = await worker.recognize(imageFileOrUrl);

    onProgress({ status: 'Finalizing text extraction...', progress: 0.9 });
    const extractedText = (result.data.text || '').trim();
    const confidence = result.data.confidence || 0;

    await worker.terminate();
    onProgress({ status: 'Done', progress: 1.0 });

    return {
      success: true,
      text: extractedText,
      confidence,
      wordsCount: result.data.words ? result.data.words.length : 0,
    };
  } catch (error) {
    console.error('OCR Processing error:', error);
    return {
      success: false,
      text: '',
      confidence: 0,
      error: error.message || 'Failed to extract text from image',
    };
  }
}

/**
 * Helper to convert K/M shorthand numbers to integers
 * e.g. "12.5k" -> 12500, "1.2M" -> 1200000, "1,450" -> 1450
 */
export function parseShorthandNumber(str) {
  if (!str) return 0;
  const clean = String(str).trim().replace(/,/g, '');
  const match = clean.match(/^([0-9.]+)\s*([kKmMbB])?$/);
  if (!match) {
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : Math.round(num);
  }
  const val = parseFloat(match[1]);
  if (isNaN(val)) return 0;
  const unit = (match[2] || '').toLowerCase();
  if (unit === 'k') return Math.round(val * 1000);
  if (unit === 'm') return Math.round(val * 1000000);
  if (unit === 'b') return Math.round(val * 1000000000);
  return Math.round(val);
}

/**
 * 1. Social Profile Parser
 * Extracts profile metadata from Instagram/Twitter/TikTok/LinkedIn/Facebook screenshot text
 * and extracts profile details for server-side review
 */
export function parseSocialProfileOcr(rawText) {
  const text = rawText || '';
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Extract username / handle
  let username = '';
  const handleMatch = text.match(/@([a-zA-Z0-9._]{3,30})/);
  if (handleMatch) {
    username = handleMatch[1];
  } else {
    // Look for handle-like string in first 5 lines
    for (const line of lines.slice(0, 5)) {
      if (/^[a-zA-Z0-9._]{3,25}$/.test(line) && !/followers|following|posts/i.test(line)) {
        username = line;
        break;
      }
    }
  }
  if (!username) username = 'unidentified_user';

  // Extract display name
  let fullname = '';
  for (const line of lines.slice(0, 5)) {
    if (line !== username && !line.startsWith('@') && !/followers|following|posts|edit|share|message/i.test(line)) {
      fullname = line;
      break;
    }
  }
  if (!fullname) fullname = username;

  // Extract counts (Posts, Followers, Following)
  let posts = 0;
  let followers = 0;
  let follows = 0;

  // Patterns like "14 posts", "1,200 followers", "450 following"
  const postsMatch = text.match(/([0-9.,]+[kKmMbB]?)\s*(?:posts?|publications|tweets?)/i);
  if (postsMatch) posts = parseShorthandNumber(postsMatch[1]);

  const followersMatch = text.match(/([0-9.,]+[kKmMbB]?)\s*(?:followers?|abonnés|seguidores)/i);
  if (followersMatch) followers = parseShorthandNumber(followersMatch[1]);

  const followingMatch = text.match(/([0-9.,]+[kKmMbB]?)\s*(?:following|follows?|abonnements|siguiendo)/i);
  if (followingMatch) follows = parseShorthandNumber(followingMatch[1]);

  // Fallback: look for 3 numbers in a row on profile headers
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

  // Detect External URL
  const urlRegex = /(?:https?:\/\/|www\.|linktr\.ee|bit\.ly|t\.me|bio\.link|wa\.me|[a-zA-Z0-9-]+\.(?:com|org|io|net|xyz|me)\b)/i;
  const externalUrl = urlRegex.test(text) ? 1 : 0;

  // Detect Private Account
  const isPrivate = /this account is private|private account|follow to see/i.test(text) ? 1 : 0;

  // Bio / description extraction
  // Capture lines after handle/name and before action buttons
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
  const bio = bioLines.join(' ').trim();
  const descriptionLength = bio.length || (text.length > 50 ? Math.min(text.length - 30, 150) : 0);

  // Compute 11 model features
  const userDigits = (username.match(/\d/g) || []).length;
  const numsLengthUsername = parseFloat((userDigits / Math.max(username.length, 1)).toFixed(4));

  const words = fullname.trim().split(/\s+/).filter(Boolean);
  const fullnameWords = Math.max(words.length, 1);

  const fullDigits = (fullname.match(/\d/g) || []).length;
  const numsLengthFullname = parseFloat((fullDigits / Math.max(fullname.length, 1)).toFixed(4));

  const nameEqualsUsername = fullname.trim().toLowerCase() === username.trim().toLowerCase() ? 1 : 0;
  const profilePic = 1; // Default present on uploaded profile screenshots

  return {
    meta: {
      username,
      fullname,
      bio,
      isPrivate,
    },
    features: {
      'profile pic': profilePic,
      'nums/length username': numsLengthUsername,
      'fullname words': fullnameWords,
      'nums/length fullname': numsLengthFullname,
      'name==username': nameEqualsUsername,
      'description length': descriptionLength,
      'external URL': externalUrl,
      'private': isPrivate,
      '#posts': posts,
      '#followers': followers,
      '#follows': follows,
    },
  };
}

/**
 * 2. Phishing URL Parser
 * Extracts URL from screenshot (address bar, link preview, QR code)
 * and extracts website address details for server-side review
 */
export function parsePhishingUrlOcr(rawText) {
  const text = rawText || '';
  
  // Extract URL candidate
  let extractedUrl = '';
  // Match full http/https URLs
  const fullUrlMatch = text.match(/https?:\/\/[^\s"'<>]+/i);
  if (fullUrlMatch) {
    extractedUrl = fullUrlMatch[0];
  } else {
    // Match domain-style strings: e.g. "secure-login.apexbank.top/verify"
    const domainMatch = text.match(/(?:[a-zA-Z0-9-]+\.)+(?:com|net|org|xyz|top|site|club|online|info|live|cc|pw|co|in|io|app)(?:\/[^\s"'<>]*)?/i);
    if (domainMatch) {
      extractedUrl = `https://${domainMatch[0]}`;
    }
  }

  if (!extractedUrl) {
    // Fallback: search for words separated by dots or slashes
    const tokenMatch = text.match(/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/);
    if (tokenMatch) extractedUrl = `http://${tokenMatch[0]}`;
  }

  // Compute 9 exact features
  const urlToParse = extractedUrl || 'https://example-phish.xyz/login';
  const urlLength = urlToParse.length;
  const numDots = (urlToParse.match(/\./g) || []).length;
  const numHyphens = (urlToParse.match(/-/g) || []).length;
  const numSlashes = (urlToParse.match(/\//g) || []).length;
  const numDigits = (urlToParse.match(/\d/g) || []).length;
  const hasAtSymbol = urlToParse.includes('@') ? 1 : 0;
  
  // Check for IPv4 address in host
  const hasIp = /(?:https?:\/\/)?(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:\/|$)/.test(urlToParse) ? 1 : 0;

  // Suspicious TLD
  const suspiciousTlds = [
    '.xyz', '.top', '.club', '.online', '.site', '.click', '.live',
    '.link', '.pw', '.vip', '.work', '.cc', '.tk', '.ga', '.cf',
    '.gq', '.ml', '.bid', '.loan', '.download', '.buzz'
  ];
  let lowerUrl = urlToParse.toLowerCase();
  const suspiciousTld = suspiciousTlds.some((tld) => {
    try {
      const parsed = new URL(urlToParse.startsWith('http') ? urlToParse : `http://${urlToParse}`);
      return parsed.hostname.endsWith(tld);
    } catch {
      return lowerUrl.includes(tld);
    }
  }) ? 1 : 0;

  // Scam keywords
  const scamKeywordsList = [
    'login', 'verify', 'update', 'secure', 'account', 'banking',
    'free', 'bonus', 'claim', 'service', 'portal', 'signin', 'support',
    'wallet', 'reward'
  ];
  const scamKeywords = scamKeywordsList.some((kw) => lowerUrl.includes(kw)) ? 1 : 0;

  return {
    url: extractedUrl,
    features: {
      url_length: urlLength,
      num_dots: numDots,
      num_hyphens: numHyphens,
      num_slashes: numSlashes,
      num_digits: numDigits,
      has_at_symbol: hasAtSymbol,
      has_ip: hasIp,
      suspicious_tld: suspiciousTld,
      scam_keywords: scamKeywords,
    },
  };
}

/**
 * 3. Fake Mobile App Parser
 * Extracts App Title, Developer, Package ID, and Store info from App Store screenshot text
 */
export function parseMobileAppOcr(rawText, registeredBrands = []) {
  const text = rawText || '';
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Detect Brand Mention
  let brandName = 'Flipkart';
  const brandKeywords = ['flipkart', 'amazon', 'paypal', 'sbi', 'paytm', 'netflix', 'google', 'apple', 'hdfc'];
  for (const b of brandKeywords) {
    if (new RegExp(`\\b${b}\\b`, 'i').test(text)) {
      brandName = b.charAt(0).toUpperCase() + b.slice(1);
      break;
    }
  }

  // App Title: look for top line with app name or words preceding "Install" or "Reviews"
  let appName = '';
  for (const line of lines.slice(0, 4)) {
    if (!/google play|app store|install|download|reviews|contains ads|in-app/i.test(line) && line.length > 2) {
      appName = line;
      break;
    }
  }
  if (!appName) appName = `${brandName} Shopping & Rewards Pro`;

  // Developer Name: look for "Offered by", "Developer:", or line right below app title
  let developerName = '';
  const devMatch = text.match(/(?:offered by|developer|by)\s*[:\-]?\s*([^\n,]+)/i);
  if (devMatch) {
    developerName = devMatch[1].trim();
  } else {
    // Look for lines that look like corporate entities
    const corpMatch = text.match(/([a-zA-Z0-9\s]+(?:Inc|LLC|Pvt|Private Limited|Ltd|Technologies|Studios|Games|Team))\b/i);
    if (corpMatch) {
      developerName = corpMatch[1].trim();
    } else {
      developerName = 'Third Party Unverified Apps Studio';
    }
  }

  // Package Name: look for com.xxx.yyy or Play Store ID
  let packageName = '';
  const packageMatch = text.match(/\b(com\.[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)\b/);
  if (packageMatch) {
    packageName = packageMatch[1];
  } else {
    const idMatch = text.match(/id=([a-zA-Z0-9_.]+)/);
    if (idMatch) {
      packageName = idMatch[1];
    } else {
      // Synthesize based on detected app title
      const cleanSlug = appName.toLowerCase().replace(/[^a-z0-9]/g, '');
      packageName = `com.${brandName.toLowerCase()}.${cleanSlug.slice(0, 15) || 'dealspay'}`;
    }
  }

  // Store URL
  let storeUrl = '';
  const urlMatch = text.match(/https?:\/\/(?:play\.google\.com|apps\.apple\.com|apkpure\.com)[^\s"']+/i);
  if (urlMatch) {
    storeUrl = urlMatch[0];
  } else {
    storeUrl = `https://play.google.com/store/apps/details?id=${packageName}`;
  }

  // Official parameters based on brand
  let officialPackage = 'com.flipkart.android';
  let officialDeveloper = 'Flipkart India Private Limited';
  if (brandName.toLowerCase() === 'amazon') {
    officialPackage = 'in.amazon.mShop.android.shopping';
    officialDeveloper = 'Amazon Mobile LLC';
  } else if (brandName.toLowerCase() === 'paypal') {
    officialPackage = 'com.paypal.android.p2pmobile';
    officialDeveloper = 'PayPal Mobile';
  } else if (brandName.toLowerCase() === 'sbi') {
    officialPackage = 'com.sbi.lotusintouch';
    officialDeveloper = 'State Bank of India';
  }

  return {
    appName,
    developerName,
    packageName,
    storeUrl,
    brandName,
    officialPackageName: officialPackage,
    officialDeveloperName: officialDeveloper,
    riskThreshold: 70,
  };
}

/**
 * 4. Scam Text Parser
 * Cleans extracted text and computes auxiliary features
 */
export function parseScamTextOcr(rawText) {
  const text = (rawText || '').trim();
  const urlCount = (text.match(/https?:\/\/[^\s]+|www\.[^\s]+/gi) || []).length;
  const scamKeywordsList = [
    'winner', 'prize', 'urgent', 'account', 'suspended', 'otp',
    'lottery', 'bitcoin', 'crypto', 'kyc', 'verify', 'refund',
    'reward', 'claim', 'free', 'investment', 'bonus', 'limited'
  ];
  let keywordCount = 0;
  const lower = text.toLowerCase();
  for (const kw of scamKeywordsList) {
    if (lower.includes(kw)) keywordCount += 1;
  }

  return {
    text,
    messageLength: text.length,
    urlCount,
    keywordCount,
  };
}

/**
 * Intelligent Intent Detection: Analyzes OCR text and recommends which of the 4 models is the best fit!
 */
export function detectModelIntentFromOcr(rawText) {
  const text = (rawText || '').toLowerCase();
  
  // 1. Phishing URL signs (browser address bar, prominent domain, URL)
  if (text.startsWith('http') || /https?:\/\//i.test(text) || /\b(?:www\.)[a-z0-9-]+\.[a-z]{2,}/i.test(text)) {
    return 'phishing_url';
  }

  // 2. Mobile App signs (Play Store, APK, Install, Ratings, Developer, Downloads)
  if (/google play|app store|apk|install\b|contains ads|in-app purchases|offered by|downloads\b|rated for/i.test(text)) {
    return 'mobile_app';
  }

  // 3. Social Profile signs (Followers, Following, Posts, Bio, @handle, Edit profile)
  if (/followers?|following|posts?\b|abonn|seguidores|edit profile|share profile|@/i.test(text)) {
    return 'social_profile';
  }

  // 4. Default: Scam Text
  return 'scam_text';
}

