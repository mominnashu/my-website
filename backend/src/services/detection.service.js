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

function fingerprintFor(doc) {
  const source=doc.sourceMetadata||{};
  const raw=doc.detectorType==='social_profile' ? `${source.platform}:${source.username||source.profileUrl}`
    : doc.detectorType==='brand_page' ? `${source.platform}:${source.pageUrl||source.handle||source.pageName}`
    : doc.detectorType==='mobile_app' ? `${source.store_name}:${source.package_name||source.app_name}`
    : doc.detectorType==='url' ? source.url
    : source.reportedAccountUrl || '';
  return raw ? `${doc.detectorType}:${String(raw).trim().toLowerCase()}` : '';
}

function enrichDetection(doc) {
  const official=(doc.reasonCodes||[]).some(code=>String(code).startsWith('OFFICIAL_'));
  const explanation=doc.evidence?.[0]?.finding || doc.scoreProvenance || 'Automated evidence assessment';
  return {
    ...doc,
    assetFingerprint:fingerprintFor(doc),
    isOfficialAsset:official,
    investigationStatus:official?'closed':'new',
    scoreBreakdown:doc.scoreBreakdown?.length?doc.scoreBreakdown:[{signal:official?'Official asset match':'Combined evidence assessment',evidence:explanation,contribution:doc.riskScore||0}],
    decisionHistory:[{from:'',to:official?'closed':'new',note:official?'Matched an official registered brand asset.':'Detection created and queued for analyst review.',actorName:'RiskProtect'}],
  };
}

async function createDetectionRecord(doc) {
  const enriched=enrichDetection(doc);
  if (mongoose.connection.readyState !== 1) {
    const existing=enriched.assetFingerprint&&memoryStore.detections.find(item=>item.organizationId===enriched.organizationId&&item.assetFingerprint===enriched.assetFingerprint&&!['closed','false_positive'].includes(item.investigationStatus));
    if(existing){existing.lastSeenAt=new Date();existing.seenCount=(existing.seenCount||1)+1;existing.riskScore=enriched.riskScore;existing.riskBand=enriched.riskBand;existing.evidence=enriched.evidence;return existing;}
    const record = {
      _id: "det-" + uuidv4().slice(0, 8),
      createdAt: new Date(),
      ...enriched,
    };
    memoryStore.detections.push(record);
    return record;
  }
  const clean=sanitizeDoc(enriched);
  if(clean.assetFingerprint){const existing=await Detection.findOneAndUpdate({organizationId:clean.organizationId,assetFingerprint:clean.assetFingerprint,investigationStatus:{$nin:['closed','false_positive']}},{$set:{lastSeenAt:new Date(),riskScore:clean.riskScore,riskBand:clean.riskBand,evidence:clean.evidence,reasonCodes:clean.reasonCodes},$inc:{seenCount:1}},{new:true});if(existing)return existing;}
  return Detection.create(clean);
}

async function createAlertRecord(doc) {
  if (mongoose.connection.readyState !== 1) {
    if (doc.assetKey) {
      const existing = memoryStore.alerts.find(item => item.organizationId === doc.organizationId && item.assetKey === doc.assetKey && item.status !== 'resolved');
      if (existing) return existing;
    }
    const record = {
      _id: "alt-" + uuidv4().slice(0, 8),
      createdAt: new Date(),
      ...doc,
    };
    memoryStore.alerts.push(record);
    return record;
  }
  const clean=sanitizeDoc(doc);
  if (clean.assetKey) {
    const existing=await Alert.findOne({organizationId:clean.organizationId,assetKey:clean.assetKey,status:{$ne:'resolved'}});
    if(existing) return existing;
  }
  return Alert.create(clean);
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

function textSimilarity(left='',right=''){
  const grams=value=>{const clean=String(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();const set=new Set();for(let i=0;i<clean.length-1;i++)set.add(clean.slice(i,i+2));return set;};
  const a=grams(left),b=grams(right);if(!a.size||!b.size)return 0;const shared=[...a].filter(value=>b.has(value)).length;return shared/(a.size+b.size-shared);
}

function fingerprintSimilarity(left='',right=''){if(!/^[a-f0-9]{16}$/i.test(left)||!/^[a-f0-9]{16}$/i.test(right))return null;const a=BigInt(`0x${left}`),b=BigInt(`0x${right}`);let value=a^b,distance=0;while(value){distance+=Number(value&1n);value>>=1n;}return 1-distance/64;}

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
    let scoreBreakdown = [];
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
      scoreBreakdown.push({signal:'Account behaviour assessment',evidence:`Profile activity produced a ${Math.round(fakeProb*100)}% suspicious-profile probability.`,contribution:riskScore});
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
      scoreBreakdown.push({signal:'Assessment unavailable',evidence:'The profile could not be scored by the detection service.',contribution:riskScore});
    }

    const identityText=`${username} ${fullname}`.toLowerCase();
    const pretextTerms=['official','support','helpdesk','customer care','verification'];
    if(pretextTerms.some(term=>identityText.includes(term))){riskScore=Math.min(100,riskScore+25);reasonCodes.push('UNVERIFIED_OFFICIAL_OR_SUPPORT_IDENTITY');evidence.push({finding:'The account name claims official or customer-support status.',type:'identity_pretext'});scoreBreakdown.push({signal:'Official or support claim',evidence:'The handle or display name claims official/customer-support status.',contribution:25});}
    if(posts<=5&&followers<200){riskScore=Math.min(100,riskScore+10);reasonCodes.push('LOW_ACTIVITY_ACCOUNT');evidence.push({finding:'Very low posting history and limited audience.',type:'low_activity'});scoreBreakdown.push({signal:'Low account history',evidence:`Only ${posts} posts and ${followers} followers were reported.`,contribution:10});}
    if(follows>Math.max(300,followers*3)){riskScore=Math.min(100,riskScore+15);reasonCodes.push('ASYMMETRIC_FOLLOWING_PATTERN');evidence.push({finding:'The account follows substantially more profiles than follow it.',type:'following_pattern'});scoreBreakdown.push({signal:'Abnormal following pattern',evidence:`Following ${follows} accounts compared with ${followers} followers.`,contribution:15});}

    // Additional Brand Registry heuristics if brandId is given
    if (brandId) {
      try {
        const brand = await findBrandById(brandId);
        if (brand) {
          const matchingHandle = brand.officialSocialHandles.find(
            (h) =>
              h.platform.toLowerCase() === platform.toLowerCase() &&
              h.handle.toLowerCase().replace(/^@/,'') === username.toLowerCase().replace(/^@/,'')
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
            scoreBreakdown=[{signal:'Official handle match',evidence:`The ${platform} handle exactly matches the registered official brand account.`,contribution:5}];
          } else if(identityText.includes(brand.name.toLowerCase())) {
            riskScore=Math.min(100,riskScore+25);reasonCodes.push('BRAND_NAME_USED_BY_UNREGISTERED_HANDLE');evidence.push({finding:`The account uses ${brand.name} but does not match its registered official handle.`,type:'brand_name_misuse'});scoreBreakdown.push({signal:'Unregistered brand-name use',evidence:`The account uses ${brand.name} without matching its official registered handle.`,contribution:25});
          }
        }
      } catch (err) {
        logger.warn(`Brand lookup failed during social detection: ${err.message}`);
      }
    }

    if(!reasonCodes.includes('OFFICIAL_BRAND_HANDLE_MATCH')){
      if(riskScore>=60)verdict='Fake Profile';
      else if(riskScore>=30)verdict='Needs Review';
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
      scoreBreakdown,
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
        assetKey: `social_profile:${String(platform).trim().toLowerCase()}:${String(username).trim().replace(/^@/,'').toLowerCase()}`,
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
    const scoreBreakdown = [{signal:'Unverified public asset',evidence:'The page is not yet matched to a registered official handle.',contribution:15}];
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
      scoreBreakdown.splice(0,scoreBreakdown.length,{signal:'Official handle match',evidence:`The ${platform} handle matches the registered official brand asset.`,contribution:5});
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
        scoreBreakdown.push({signal:'Similar brand name',evidence:`The page name closely resembles ${brandName}.`,contribution:35});
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
          scoreBreakdown.push({signal:'Domain mismatch',evidence:'The claimed website is not registered as an official brand domain.',contribution:30});
        }
      }

      if (bio && (bio.toLowerCase().includes("official") || bio.toLowerCase().includes("support") || bio.toLowerCase().includes("helpdesk"))) {
        riskScore += 15;
        reasonCodes.push("OFFICIAL_OR_SUPPORT_PRETEXT_IN_BIO");
        evidence.push({
          finding: "Bio contains claims of being official customer support or helpdesk",
          type: "pretexting",
        });
        scoreBreakdown.push({signal:'Official-support claim',evidence:'The biography claims official or support status without an official handle match.',contribution:15});
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
      scoreBreakdown,
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
        assetKey: `brand_page:${String(platform).trim().toLowerCase()}:${String(pageUrl||handle||pageName).trim().toLowerCase()}`,
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
      app_description,
      official_description,
      logo_similarity,
      suspected_logo_fingerprint,
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
    let officialLogoFingerprint = '';
    if (official_developer_name) officialDevs.push(official_developer_name);

    if (brandId) {
      try {
        const brand = await findBrandById(brandId);
        if (brand) {
          targetBrandName = brand.name;
          officialPkgs = [...new Set([...officialPkgs, ...(brand.officialAppPackages || [])])];
          officialDevs = [...new Set([...officialDevs, ...(brand.officialDevelopers || [])])];
          officialLogoFingerprint = brand.officialLogoFingerprint || '';
        }
      } catch (err) {
        logger.warn(`Brand lookup in mobile app detection: ${err.message}`);
      }
    }

    const enginePayload = {
      app_name,
      package_name,
      developer_name,
      app_description,
      official_description,
      logo_similarity,
      suspected_logo_fingerprint,
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

    const automaticLogoSimilarity=fingerprintSimilarity(suspected_logo_fingerprint,officialLogoFingerprint);
    const effectiveLogoSimilarity=automaticLogoSimilarity??logo_similarity;
    const nameSimilarity=textSimilarity(app_name,targetBrandName||app_name);
    const descriptionSimilarity=textSimilarity(app_description,official_description);
    const publisherMismatch=officialDevs.length>0&&!officialDevs.some(value=>String(value).trim().toLowerCase()===developer_name.trim().toLowerCase());
    const visibleBreakdown=[];
    if(nameSimilarity>=0.65)visibleBreakdown.push({signal:'Similar application name',evidence:`The suspected app name is ${Math.round(nameSimilarity*100)}% similar to the protected brand name.`,contribution:25});
    if(typeof effectiveLogoSimilarity==='number'&&effectiveLogoSimilarity>=0.65)visibleBreakdown.push({signal:'Similar logo',evidence:`The visual fingerprint comparison reports ${Math.round(effectiveLogoSimilarity*100)}% logo resemblance.`,contribution:25});
    if(descriptionSimilarity>=0.45)visibleBreakdown.push({signal:'Description overlap',evidence:`The public descriptions overlap by ${Math.round(descriptionSimilarity*100)}%.`,contribution:15});
    if(publisherMismatch)visibleBreakdown.push({signal:'Publisher mismatch',evidence:`${developer_name} is not registered as an official publisher for this brand.`,contribution:25});
    if(visibleBreakdown.length)riskScore=Math.max(riskScore,Math.min(100,visibleBreakdown.reduce((total,item)=>total+item.contribution,10)));

    const normalizedPackage=package_name.trim().toLowerCase();
    const normalizedDeveloper=developer_name.trim().toLowerCase();
    const packageOfficial=officialPkgs.some(value=>String(value).trim().toLowerCase()===normalizedPackage);
    const developerOfficial=officialDevs.some(value=>String(value).trim().toLowerCase()===normalizedDeveloper);
    if(packageOfficial&&developerOfficial){verdict='Legitimate App';riskScore=5;reasonCodes=['OFFICIAL_APP_CONFIRMED'];evidence=[{finding:'Package ID and publisher match the registered official application.',verified:true}];limitations='Official asset registry exact match.';}

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
      scoreBreakdown:packageOfficial&&developerOfficial?[{signal:'Official package and publisher match',evidence:'The package identifier and publisher exactly match registered official assets.',contribution:5}]:(visibleBreakdown.length?visibleBreakdown:[{signal:'Application metadata assessment',evidence:evidence[0]?.finding||'Application metadata was compared with registered official brand assets.',contribution:riskScore}]),
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
        assetKey: `mobile_app:${String(package_name||app_name).trim().toLowerCase()}`,
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
        assetKey: `url:${String(url).trim().toLowerCase()}`,
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
