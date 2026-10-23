import mongoose from "mongoose";
import { Detection } from "../models/Detection.js";
import { Alert } from "../models/Alert.js";
import { Brand } from "../models/Brand.js";
import { mlClient } from "./mlClient.service.js";
import { logger } from "../utils/logger.js";
import { memoryStore } from "../utils/memoryStore.js";
import { v4 as uuidv4 } from "uuid";

function sanitizeDoc(doc) {
  const clean = { ...doc };
  if (!clean.brandId || !mongoose.Types.ObjectId.isValid(clean.brandId)) {
    delete clean.brandId;
  }
  if (!clean.createdBy || !mongoose.Types.ObjectId.isValid(clean.createdBy)) {
    delete clean.createdBy;
  }
  if (clean.organizationId && !mongoose.Types.ObjectId.isValid(clean.organizationId)) {
    delete clean.organizationId;
  }
  return clean;
}

async function createDetectionRecord(doc) {
  if (mongoose.connection.readyState !== 1) {
    const record = {
      _id: "det-" + uuidv4().slice(0, 8),
      createdAt: new Date(),
      ...doc,
    };
    memoryStore.detections.push(record);
    return record;
  }
  return Detection.create(sanitizeDoc(doc));
}

async function createAlertRecord(doc) {
  if (mongoose.connection.readyState !== 1) {
    const record = {
      _id: "alt-" + uuidv4().slice(0, 8),
      createdAt: new Date(),
      ...doc,
    };
    memoryStore.alerts.push(record);
    return record;
  }
  return Alert.create(sanitizeDoc(doc));
}

async function findBrandById(brandId) {
  if (!brandId) return null;
  if (mongoose.connection.readyState !== 1) {
    return memoryStore.brands.find((b) => b._id === brandId) || null;
  }
  return Brand.findById(brandId);
}

function calculateRiskBand(score) {
  if (score === null || score === undefined) return "Low";
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 30) return "Medium";
  return "Low";
}

function calculateSeverityFromRisk(riskBand) {
  return riskBand.toLowerCase();
}

export const detectionService = {
  /**
   * Module 1: Fake Social Profile Detection
   */
  async detectSocialProfile(data, user) {
    const {
      brandId,
      platform,
      profileUrl,
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
      posts,
      followers,
      follows,
      notes,
    } = data;

    const mlFeatures = {
      profile_pic,
      nums_length_username,
      fullname_words,
      nums_length_fullname,
      name_equals_username,
      description_length,
      external_url,
      private: isPrivate,
      posts,
      followers,
      follows,
    };

    const mlResult = await mlClient.predictFakeProfile(mlFeatures);

    let verdict = "Needs Review";
    let riskScore = 50;
    let scoreProvenance = "Fallback heuristic evaluation";
    let modelVersion = "1.0.0";
    let isMlModel = true;
    let reasonCodes = [];
    let evidence = [];
    let limitations = "Features provided directly without automated live scraping.";

    if (mlResult.success) {
      const pred = mlResult.data;
      const fakeProb = typeof pred.probability_fake === "number"
        ? pred.probability_fake
        : (typeof pred.fake_probability === "number" ? pred.fake_probability : (pred.predicted_class === 1 ? 0.88 : 0.12));

      const isFake = pred.predicted_class === 1 || pred.predicted_label === "Fake" || fakeProb >= 0.5;
      riskScore = typeof pred.risk_score === "number" ? pred.risk_score : Math.round(fakeProb * 100);
      verdict = isFake ? "Fake Profile" : "Real / Genuine Profile";
      scoreProvenance = `Random Forest fake profile model: predicted class ${isFake ? "1 (Fake)" : "0 (Real)"} with probability ${fakeProb}`;
      modelVersion = pred.model_version || "1.0.0";
      reasonCodes = pred.reason_codes || [];
      evidence = pred.evidence || [];
      limitations = pred.limitations || limitations;
    } else {
      verdict = "Detector Unavailable";
      riskScore = 50;
      scoreProvenance = `ML Service connection failure: ${mlResult.error}`;
      reasonCodes.push("DETECTOR_OFFLINE");
      evidence.push({
        finding: "ML inference service was unreachable during evaluation",
        status: "offline",
      });
    }

    // Additional Brand Registry heuristics if brandId is given
    if (brandId) {
      try {
        const brand = await findBrandById(brandId);
        if (brand) {
          const matchingHandle = brand.officialSocialHandles.find(
            (h) =>
              h.platform.toLowerCase() === platform.toLowerCase() &&
              h.handle.toLowerCase() === username.toLowerCase()
          );
          if (matchingHandle) {
            verdict = "No Issue Detected";
            riskScore = 5;
            scoreProvenance += " | Verified match against official brand handle registry";
            reasonCodes.unshift("OFFICIAL_BRAND_HANDLE_MATCH");
            evidence.unshift({
              field: "handle",
              finding: `Matches registered official ${platform} handle for ${brand.name}`,
              verdict: "authentic",
            });
          }
        }
      } catch (err) {
        logger.warn(`Brand lookup failed during social detection: ${err.message}`);
      }
    }

    const riskBand = calculateRiskBand(riskScore);

    const detection = await createDetectionRecord({
      organizationId: user.organizationId,
      brandId: brandId || null,
      detectorType: "social_profile",
      sourceMetadata: {
        platform,
        profileUrl,
        username,
        fullname,
        notes,
      },
      submittedInput: mlFeatures,
      verdict,
      riskScore,
      riskBand,
      scoreProvenance,
      modelVersion,
      isMlModel,
      reasonCodes,
      evidence,
      limitations,
      createdBy: user.id,
    });

    // Auto-create alert if High or Critical risk
    if (riskBand === "High" || riskBand === "Critical") {
      await createAlertRecord({
        organizationId: user.organizationId,
        detectionId: detection._id,
        brandId: brandId || null,
        title: `Impersonation Alert: @${username} on ${platform}`,
        severity: calculateSeverityFromRisk(riskBand),
        status: "new",
      });
    }

    return detection;
  },

  /**
   * Module 2: Fake Brand Page Detection
   */
  async detectBrandPage(data, user) {
    const {
      brandId,
      platform,
      pageUrl,
      pageName,
      handle,
      bio,
      claimedWebsite,
      followerCount,
      notes,
    } = data;

    let brand = null;
    try {
      brand = await findBrandById(brandId);
    } catch (err) {
      logger.warn(`Brand not found: ${err.message}`);
    }

    const brandName = brand ? brand.name : "Target Brand";
    const officialDomains = brand ? brand.officialDomains : [];
    const officialHandles = brand ? brand.officialSocialHandles : [];

    const evidence = [];
    const reasonCodes = [];
    let riskScore = 15;

    // Check handle match
    const matchingOfficialHandle = officialHandles.find(
      (h) =>
        h.platform.toLowerCase() === platform.toLowerCase() &&
        h.handle.toLowerCase() === handle.toLowerCase()
    );

    if (matchingOfficialHandle) {
      riskScore = 5;
      reasonCodes.push("OFFICIAL_PAGE_CONFIRMED");
      evidence.push({
        finding: "Handle matches verified brand registry",
        verified: true,
      });
    } else {
      // Impersonation risk checks
      const pageNameLower = pageName.toLowerCase();
      const brandLower = brandName.toLowerCase();

      if (pageNameLower.includes(brandLower) || brandLower.includes(pageNameLower)) {
        riskScore += 35;
        reasonCodes.push("BRAND_NAME_CLAIMED_BY_UNVERIFIED_PAGE");
        evidence.push({
          finding: `Page name "${pageName}" closely mirrors official brand name "${brandName}"`,
          type: "name_similarity",
        });
      }

      if (claimedWebsite) {
        const matchesOfficialDomain = officialDomains.some((d) =>
          claimedWebsite.toLowerCase().includes(d.toLowerCase())
        );
        if (!matchesOfficialDomain) {
          riskScore += 30;
          reasonCodes.push("UNOFFICIAL_WEBSITE_DOMAIN");
          evidence.push({
            finding: `Claimed website "${claimedWebsite}" is NOT among official brand domains: ${officialDomains.join(", ") || "None"}`,
            type: "domain_mismatch",
          });
        }
      }

      if (bio && (bio.toLowerCase().includes("official") || bio.toLowerCase().includes("support") || bio.toLowerCase().includes("helpdesk"))) {
        riskScore += 15;
        reasonCodes.push("OFFICIAL_OR_SUPPORT_PRETEXT_IN_BIO");
        evidence.push({
          finding: "Bio contains claims of being official customer support or helpdesk",
          type: "pretexting",
        });
      }
    }

    riskScore = Math.min(100, riskScore);
    const riskBand = calculateRiskBand(riskScore);

    let verdict = "No Issue Detected";
    if (riskScore >= 75) verdict = "Likely Impersonation";
    else if (riskScore >= 45) verdict = "Suspicious";
    else if (riskScore >= 25) verdict = "Needs Review";

    const detection = await createDetectionRecord({
      organizationId: user.organizationId,
      brandId,
      detectorType: "brand_page",
      sourceMetadata: {
        platform,
        pageUrl,
        pageName,
        handle,
        claimedWebsite,
        followerCount,
        notes,
      },
      submittedInput: data,
      verdict,
      riskScore,
      riskBand,
      scoreProvenance: "Deterministic Brand Registry Verification & Impersonation Heuristics",
      modelVersion: "1.0.0",
      isMlModel: false,
      reasonCodes,
      evidence,
      limitations: "Heuristic brand similarity comparison based on verified registered brand assets.",
      createdBy: user.id,
    });

    if (riskBand === "High" || riskBand === "Critical") {
      await createAlertRecord({
        organizationId: user.organizationId,
        detectionId: detection._id,
        brandId,
        title: `Suspected Impersonating Brand Page: ${pageName} on ${platform}`,
        severity: calculateSeverityFromRisk(riskBand),
        status: "new",
      });
    }

    return detection;
  },

  /**
   * Module 3: Scam Account and Message Detection
   */
  async detectScamText(data, user) {
    const { text, brandId, platform, reportedAccountUrl, notes } = data;

    const mlResult = await mlClient.predictScamText({
      text,
      threshold: 0.5,
    });

    let verdict = "Needs Review";
    let riskScore = 40;
    let scoreProvenance = "Fallback NLP evaluation";
    let modelVersion = "1.0.0";
    let reasonCodes = [];
    let evidence = [];
    let limitations = "TF-IDF + NLP classification without full user conversation context.";

    if (mlResult.success) {
      const pred = mlResult.data;
      const scamProb = typeof pred.probability_scam === "number"
        ? pred.probability_scam
        : (typeof pred.scam_probability === "number" ? pred.scam_probability : (pred.predicted_class === 1 ? 0.92 : 0.08));

      riskScore = typeof pred.risk_score === "number" ? pred.risk_score : Math.round(scamProb * 100);
      verdict = pred.verdict || (pred.predicted_label === "Scam" || pred.predicted_class === 1 ? "Confirmed Scam / Phishing" : "Legitimate Message");
      scoreProvenance = pred.score_provenance || `NLP Scam Text Classifier scam probability: ${scamProb}`;
      modelVersion = pred.model_version || "1.0.0";
      reasonCodes = pred.reason_codes || [];
      evidence = pred.evidence || [];
      limitations = pred.limitations || limitations;
    } else {
      verdict = "Detector Unavailable";
      riskScore = 40;
      scoreProvenance = `ML Service error: ${mlResult.error}`;
      reasonCodes.push("DETECTOR_OFFLINE");
    }

    const riskBand = calculateRiskBand(riskScore);

    const detection = await createDetectionRecord({
      organizationId: user.organizationId,
      brandId: brandId || null,
      detectorType: "scam_text",
      sourceMetadata: {
        platform,
        reportedAccountUrl,
        textSnippet: text.slice(0, 120),
        notes,
      },
      submittedInput: { text, platform },
      verdict,
      riskScore,
      riskBand,
      scoreProvenance,
      modelVersion,
      isMlModel: true,
      reasonCodes,
      evidence,
      limitations,
      createdBy: user.id,
    });

    if (riskBand === "High" || riskBand === "Critical") {
      await createAlertRecord({
        organizationId: user.organizationId,
        detectionId: detection._id,
        brandId: brandId || null,
        title: `Scam Message Detected: ${text.slice(0, 60)}...`,
        severity: calculateSeverityFromRisk(riskBand),
        status: "new",
      });
    }

    return detection;
  },

  /**
   * Module 4: Fake Mobile Application Detection
   */
  async detectMobileApp(data, user) {
    const {
      brandId,
      brand_name,
      app_name,
      package_name,
      developer_name,
      store_name,
      store_url,
      official_package_name,
      official_developer_name,
      official_packages = [],
      official_developers = [],
      permissions = [],
      store_verified = false,
      risk_threshold = 70,
      notes,
    } = data;

    let targetBrandName = brand_name;
    let officialPkgs = [...official_packages];
    if (official_package_name) officialPkgs.push(official_package_name);
    let officialDevs = [...official_developers];
    if (official_developer_name) officialDevs.push(official_developer_name);

    if (brandId) {
      try {
        const brand = await findBrandById(brandId);
        if (brand) {
          targetBrandName = brand.name;
          officialPkgs = [...new Set([...officialPkgs, ...(brand.officialAppPackages || [])])];
          officialDevs = [...new Set([...officialDevs, ...(brand.officialDevelopers || [])])];
        }
      } catch (err) {
        logger.warn(`Brand lookup in mobile app detection: ${err.message}`);
      }
    }

    const enginePayload = {
      app_name,
      package_name,
      developer_name,
      associated_brand: targetBrandName || app_name,
      brand_name: targetBrandName || app_name,
      store_name,
      store_url,
      official_package_name,
      official_developer_name,
      official_packages: officialPkgs,
      official_developers: officialDevs,
      permissions,
      store_verified,
      risk_threshold,
    };

    const mlResult = await mlClient.analyzeFakeApp(enginePayload);

    let verdict = "Needs Review";
    let riskScore = 40;
    let scoreProvenance = "Deterministic Mobile App Rule Engine";
    let modelVersion = "1.0.0";
    let reasonCodes = [];
    let evidence = [];
    let limitations = "";

    if (mlResult.success) {
      const res = mlResult.data;
      verdict = res.verdict;
      riskScore = res.risk_score;
      scoreProvenance = `App Rules Engine against brand "${res.brand_matched}"`;
      modelVersion = res.engine_version;
      reasonCodes = res.reason_codes || [];
      evidence = res.evidence || [];
      limitations = res.limitations;
    } else {
      verdict = "Detector Unavailable";
      scoreProvenance = `ML Service error: ${mlResult.error}`;
      reasonCodes.push("DETECTOR_OFFLINE");
    }

    const riskBand = calculateRiskBand(riskScore);

    const detection = await createDetectionRecord({
      organizationId: user.organizationId,
      brandId: brandId || null,
      detectorType: "mobile_app",
      sourceMetadata: {
        app_name,
        package_name,
        developer_name,
        store_name,
        store_url,
        notes,
      },
      submittedInput: enginePayload,
      verdict,
      riskScore,
      riskBand,
      scoreProvenance,
      modelVersion,
      isMlModel: false,
      reasonCodes,
      evidence,
      limitations,
      createdBy: user.id,
    });

    if (riskBand === "High" || riskBand === "Critical") {
      await createAlertRecord({
        organizationId: user.organizationId,
        detectionId: detection._id,
        brandId: brandId || null,
        title: `Rogue Mobile App Detected: ${app_name} (${package_name})`,
        severity: calculateSeverityFromRisk(riskBand),
        status: "new",
      });
    }

    return detection;
  },

  /**
   * Module 5: Suspicious URL Detection
   */
  async detectUrl(data, user) {
    const { url, brandId, check_rules = true, use_ml = true, precomputed_features, features, notes } = data;

    let targetBrand = null;
    let officialDomains = [];
    if (brandId) {
      try {
        targetBrand = await findBrandById(brandId);
        if (targetBrand) {
          officialDomains = targetBrand.officialDomains || [];
        }
      } catch (e) {
        logger.warn(`Brand lookup in url detection: ${e.message}`);
      }
    }

    // Call rules analysis
    let ruleRes = null;
    if (check_rules) {
      const res = await mlClient.analyzeUrlRules({
        url,
        brand_name: targetBrand ? targetBrand.name : null,
        official_domains: officialDomains,
      });
      if (res.success) {
        ruleRes = res.data;
      }
    }

    // Call ML prediction if requested
    let mlRes = null;
    if (use_ml) {
      const res = await mlClient.predictPhishingUrl({ url, precomputed_features, features });
      if (res.success) {
        mlRes = res.data;
      }
    }

    let riskScore = 10;
    let verdict = "No Issue Detected";
    let reasonCodes = [];
    let evidence = [];
    let scoreProvenance = "";
    let limitations = "Heuristic URL rules and Random Forest syntactic lexical model.";

    if (ruleRes) {
      riskScore = Math.max(riskScore, typeof ruleRes.risk_score === "number" ? ruleRes.risk_score : 10);
      reasonCodes = [...(ruleRes.reason_codes || [])];
      evidence = [...(ruleRes.evidence || ruleRes.findings || [])];
      scoreProvenance = `Deterministic Lexical Rules (Score: ${ruleRes.risk_score ?? riskScore})`;
      if (ruleRes.verdict && (ruleRes.risk_score >= 50 || verdict === "No Issue Detected")) {
        verdict = ruleRes.verdict;
      }
    }

    if (mlRes) {
      const mlProb = typeof mlRes.probability_phishing === "number"
        ? mlRes.probability_phishing
        : (typeof mlRes.phishing_probability === "number" ? mlRes.phishing_probability : null);

      const mlScore = typeof mlRes.risk_score === "number"
        ? mlRes.risk_score
        : (mlProb !== null ? Math.round(mlProb * 100) : (mlRes.predicted_class === 1 ? 85 : 15));

      const mlVerdict = mlRes.verdict || (mlRes.predicted_label === "Phishing" || mlRes.predicted_class === 1 ? "Phishing URL" : "Legitimate URL");

      scoreProvenance += (scoreProvenance ? " | " : "") + `RF Classifier prob: ${mlProb !== null ? mlProb : (mlRes.message || "evaluated")}`;
      if (mlScore > riskScore) {
        riskScore = mlScore;
        verdict = mlVerdict;
      }
      evidence.push({
        detector: "phishing_url_rf",
        probability: mlProb,
        finding: `Random Forest classified as ${mlVerdict}${mlProb !== null ? ` with probability ${mlProb}` : ""}`,
      });
      if (mlRes.extracted_features) {
        evidence.push({
          detector: "phishing_url_rf",
          finding: `Evaluated 9 model features: ${JSON.stringify(mlRes.extracted_features)}`,
          features: mlRes.extracted_features,
        });
      }
      if (Array.isArray(mlRes.evidence)) {
        evidence.push(...mlRes.evidence);
      }
      if (Array.isArray(mlRes.reason_codes)) {
        reasonCodes = [...new Set([...reasonCodes, ...mlRes.reason_codes])];
      }
    }

    if (!ruleRes && !mlRes) {
      verdict = "Detector Unavailable";
      riskScore = 30;
      reasonCodes.push("DETECTOR_OFFLINE");
      scoreProvenance = "URL detection services unavailable";
    }

    const riskBand = calculateRiskBand(riskScore);

    const detection = await createDetectionRecord({
      organizationId: user.organizationId,
      brandId: brandId || null,
      detectorType: "url",
      sourceMetadata: {
        url,
        notes,
      },
      submittedInput: { url, check_rules, use_ml },
      verdict,
      riskScore,
      riskBand,
      scoreProvenance,
      modelVersion: "1.0.0",
      isMlModel: Boolean(mlRes),
      reasonCodes,
      evidence,
      limitations,
      createdBy: user.id,
    });

    if (riskBand === "High" || riskBand === "Critical") {
      await createAlertRecord({
        organizationId: user.organizationId,
        detectionId: detection._id,
        brandId: brandId || null,
        title: `Phishing Link Detected: ${url}`,
        severity: calculateSeverityFromRisk(riskBand),
        status: "new",
      });
    }

    return detection;
  },

  /**
   * List detections with query filtering & pagination
   */
  async listDetections(query, user) {
    if (mongoose.connection.readyState !== 1) {
      let filtered = [...memoryStore.detections];
      if (query.detectorType) filtered = filtered.filter((d) => d.detectorType === query.detectorType);
      if (query.verdict) filtered = filtered.filter((d) => d.verdict === query.verdict);
      if (query.riskBand) filtered = filtered.filter((d) => d.riskBand === query.riskBand);
      return {
        items: filtered.reverse(),
        total: filtered.length,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
    }

    const {
      page = 1,
      limit = 20,
      detectorType,
      verdict,
      riskBand,
      brandId,
      search,
    } = query;

    const filter = {
      organizationId: user.organizationId,
    };

    if (detectorType) filter.detectorType = detectorType;
    if (verdict) filter.verdict = verdict;
    if (riskBand) filter.riskBand = riskBand;
    if (brandId) filter.brandId = brandId;

    if (search) {
      filter.$or = [
        { "sourceMetadata.username": { $regex: search, $options: "i" } },
        { "sourceMetadata.url": { $regex: search, $options: "i" } },
        { "sourceMetadata.app_name": { $regex: search, $options: "i" } },
        { "sourceMetadata.package_name": { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [items, total] = await Promise.all([
      Detection.find(filter)
        .populate("brandId", "name officialDomains")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take),
      Detection.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page: parseInt(page, 10),
      limit: take,
      totalPages: Math.ceil(total / take) || 1,
    };
  },

  async getDetectionById(detectionId, user) {
    if (mongoose.connection.readyState !== 1) {
      return memoryStore.detections.find((d) => d._id === detectionId) || null;
    }
    return Detection.findOne({
      _id: detectionId,
      organizationId: user.organizationId,
    }).populate("brandId", "name officialDomains officialSocialHandles");
  },
};
