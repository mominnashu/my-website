import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Sparkles,
  Upload,
  Globe,
  Smartphone,
  MessageSquare,
  FileText,
  UserX,
  AlertCircle,
  CheckCircle,
  Copy,
  ArrowRight,
  Loader2,
  FileUp,
  BookOpen,
  Sliders,
  Download,
  Info,
  X,
  Check,
  Activity,
  Layers,
  Cpu,
} from 'lucide-react';
import { api } from '../services/api';
import {
  recognizeImageText,
  parseSocialProfileOcr,
  parsePhishingUrlOcr,
  parseMobileAppOcr,
  parseScamTextOcr,
  detectModelIntentFromOcr,
} from '../services/ocr';
import { imageFingerprint } from '../services/imageFingerprint';

export const MODEL_SPECS = {
  social_profile: {
    title: '1. Fake Social Media Profile Detection',
    type: 'Automated risk review',
    size: '1.64 MB',
    featureCount: '11 Numeric Features',
    classes: '0 = Genuine, 1 = Fake',
    description:
      'Reviews profile details and account activity for potential warning signs.',
    features: [
      { name: 'profile pic', type: 'Integer (0/1)', desc: 'Profile picture ఉందా? (1 = Present, 0 = Default avatar)' },
      { name: 'nums/length username', type: 'Float [0.0 - 1.0]', desc: 'Usernameలోని digits నిష్పత్తి (Ratio of numeric digits to username length)' },
      { name: 'fullname words', type: 'Integer', desc: 'Full nameలోని పదాల సంఖ్య (Count of distinct words in display name)' },
      { name: 'nums/length fullname', type: 'Float [0.0 - 1.0]', desc: 'Full nameలోని digits నిష్పత్తి (Ratio of numeric digits in full name)' },
      { name: 'name==username', type: 'Integer (0/1)', desc: 'Name, username ఒకటేనా? (1 if display name == handle, 0 otherwise)' },
      { name: 'description length', type: 'Integer', desc: 'Profile description పొడవు (Character count of biography / description)' },
      { name: 'external URL', type: 'Integer (0/1)', desc: 'Profileలో external URL ఉందా? (1 if link in bio, 0 otherwise)' },
      { name: 'private', type: 'Integer (0/1)', desc: 'Account privateగా ఉందా? (1 if account is private, 0 if public)' },
      { name: '#posts', type: 'Integer', desc: 'Posts సంఖ్య (Total published posts)' },
      { name: '#followers', type: 'Integer', desc: 'Followers సంఖ్య (Total user audience count)' },
      { name: '#follows', type: 'Integer', desc: 'Follow అవుతున్న accounts సంఖ్య (Total accounts followed)' },
    ],
  },
  scam_text: {
    title: '2. Scam Text Detection',
    type: 'Automated message review',
    size: '711 KB',
    featureCount: 'Text content review',
    classes: '0 = Legitimate / Not Scam, 1 = Scam',
    description:
      'Reviews message content for urgent requests, credential collection and suspicious payment instructions.',
    features: [
      { name: 'text', type: 'String', desc: 'Analyze చేయాల్సిన message లేదా text (Raw SMS, chat, or bio payload)' },
      { name: 'message_length', type: 'Integer (Computed)', desc: 'Messageలోని characters సంఖ్య (Length of analyzed string)' },
      { name: 'url_count', type: 'Integer (Computed)', desc: 'Messageలోని URLs సంఖ్య (Count of web links or URL shorteners)' },
      { name: 'keyword_count', type: 'Integer (Computed)', desc: 'గుర్తించిన scam keywords సంఖ్య (Count of social engineering scam triggers)' },
    ],
  },
  url: {
    title: '3. Phishing URL Detection',
    type: 'Automated link review',
    size: '32.39 MB',
    featureCount: '9 Numeric Syntactic Features',
    classes: '0 = Legitimate, 1 = Phishing',
    description:
      'Reviews website addresses for patterns commonly associated with unsafe links.',
    features: [
      { name: 'url_length', type: 'Integer', desc: 'URL మొత్తం పొడవు (Total character length of URL)' },
      { name: 'num_dots', type: 'Integer', desc: 'URLలోని dots (.) సంఖ్య (Period count indicating subdomains)' },
      { name: 'num_hyphens', type: 'Integer', desc: 'Hyphens (-) సంఖ్య (Hyphen count used for typosquatting)' },
      { name: 'num_slashes', type: 'Integer', desc: 'Slashes (/) సంఖ్య (Path segment depth)' },
      { name: 'num_digits', type: 'Integer', desc: 'URLలోని digits సంఖ్య (Count of numbers in URL)' },
      { name: 'has_at_symbol', type: 'Integer (0/1)', desc: '@ symbol ఉందా? (1 if @ credential deception trick is present)' },
      { name: 'has_ip', type: 'Integer (0/1)', desc: 'URL hostలో IP address ఉందా? (1 if direct IPv4 host used)' },
      { name: 'suspicious_tld', type: 'Integer (0/1)', desc: 'TLDను suspiciousగా గుర్తించారా? (1 if high-abuse TLD registered)' },
      { name: 'scam_keywords', type: 'Integer (0/1)', desc: 'నిర్దేశించిన scam keywords ఉన్నాయా? (1 if login, verify, banking keywords found)' },
    ],
  },
  mobile_app: {
    title: '4. Fake Mobile App Detection',
    type: 'Rules-Based Threat Engine & Brand Cross-Referencing',
    size: '159 Bytes (Configuration Dict)',
    featureCount: 'Brand Registry Cross-Referencing & Permissions Matrix',
    classes: 'Verdict: Impersonation / Suspicious / Legitimate',
    description:
      'Deterministic rules engine auditing Android package namespaces, developer signatures, unverified distribution marketplaces, and sensitive permissions.',
    features: [
      { name: 'app_name', type: 'String', desc: 'App పేరు (Application display title)' },
      { name: 'package_name', type: 'String', desc: 'Android package identifier (e.g. com.brand.app)' },
      { name: 'developer_name', type: 'String', desc: 'App developer పేరు (Published developer entity name)' },
      { name: 'store_url', type: 'String / URL', desc: 'App store listing URL (Play Store, APKMirror, etc.)' },
      { name: 'brand_name', type: 'String', desc: 'ఏ brandను impersonate చేస్తున్నదో (Target brand name)' },
      { name: 'official_package_name', type: 'String', desc: 'Brand యొక్క official app package (e.g. com.flipkart.android)' },
      { name: 'official_developer_name', type: 'String', desc: 'Brand official developer (e.g. Flipkart India Private Limited)' },
      { name: 'risk_threshold', type: 'Integer (0-100)', desc: 'Risk classification threshold (Artifact default: 70)' },
    ],
  },
  brand_page: {
    title: 'Brand Page Impersonation Heuristics',
    type: 'Brand Asset Verification Rules',
    size: 'Native Engine',
    featureCount: '4 Heuristic Vectors',
    classes: 'Verdict: Impersonation / Suspicious / Authentic',
    description:
      'Cross-references social page names, claimed websites, handles, and customer support claims with registered brand assets.',
    features: [
      { name: 'pageName', type: 'String', desc: 'Social page display name' },
      { name: 'platform', type: 'Enum', desc: 'Social platform (Facebook, LinkedIn, Twitter, Telegram)' },
      { name: 'handle', type: 'String', desc: 'Social profile handle identifier' },
      { name: 'claimedWebsite', type: 'String / URL', desc: 'External link advertised on page' },
      { name: 'bio', type: 'String', desc: 'Biography / description for pretexting check' },
    ],
  },
};

export default function DetectorsPage({ initialDetector = 'social_profile', onEscalateToCase }) {
  const [activeTab, setActiveTab] = useState(initialDetector);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [specModalKey, setSpecModalKey] = useState(null);

  // 1. Social Profile Form State
  const [socialForm, setSocialForm] = useState({
    username: 'support_apexbank_official',
    fullname: 'Apex Bank Customer Support',
    platform: 'instagram',
    profile_pic: 1,
    nums_length_username: 0.0,
    fullname_words: 4,
    nums_length_fullname: 0.0,
    name_equals_username: 0,
    description_length: 120,
    external_url: 1,
    private: 0,
    posts: 4,
    followers: 120,
    follows: 450,
    brandId: '',
    notes: 'Reported by fraud desk for direct-messaging customers asking for OTP.',
  });

  // 2. Brand Page Form State
  const [brandPageForm, setBrandPageForm] = useState({
    brandId: '',
    platform: 'facebook',
    pageName: 'Apex Bank Help Desk Support',
    pageUrl: 'https://facebook.com/apex-bank-helpdesk-resolution',
    handle: '@ApexBankHelpDesk',
    claimedWebsite: 'https://apex-banking-support.xyz',
    bio: 'Official 24/7 emergency customer care and loan assistance desk.',
    followerCount: 340,
    notes: 'Impersonating customer service desk.',
  });

  // 3. Scam Text Form State
  const [scamTextForm, setScamTextForm] = useState({
    text: 'URGENT: Your Apex Bank account has been locked due to suspicious login attempts. Verify your SSN and PIN immediately at https://bit.ly/apex-unlock or your account will be suspended permanently.',
    platform: 'sms',
    brandId: '',
  });

  // 4. Mobile App Form State
  const [appForm, setAppForm] = useState({
    app_name: 'Apex Quick Instant Loan',
    package_name: 'com.apex.fastloan.instantcash',
    developer_name: 'Apex Global Financial Tech Ltd',
    store_name: 'APKMirror',
    store_url: 'https://apkmirror-free-apk.xyz/apex-loan.apk',
    brand_name: 'Apex Bank',
    official_package_name: 'com.apexbank.mobile',
    official_developer_name: 'Apex Bank NA',
    risk_threshold: 70,
    store_verified: false,
    permissions: [
      'android.permission.READ_CONTACTS',
      'android.permission.READ_SMS',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.CAMERA',
    ],
    official_packages: ['com.apexbank.mobile', 'com.apexbank.auth'],
    official_developers: ['Apex Bank NA'],
    brandId: '',
    notes: 'Aggressive rogue loan application scraping contacts and SMS.',
    suspected_logo_fingerprint: '',
  });

  // 5. URL Form State
  const [urlForm, setUrlForm] = useState({
    url: 'https://apex-bank-secure-auth.account-update.cc/login',
    check_rules: true,
    use_ml: true,
    brandId: '',
    manualOverride: false,
    features: {
      url_length: 55,
      num_dots: 3,
      num_hyphens: 4,
      num_slashes: 3,
      num_digits: 0,
      has_at_symbol: 0,
      has_ip: 0,
      suspicious_tld: 1,
      scam_keywords: 1,
    },
  });

  // OCR Scanner State across all 4 models
  const [ocrImage, setOcrImage] = useState(null);
  const [ocrPreview, setOcrPreview] = useState('');
  const [ocrProgress, setOcrProgress] = useState(null);
  const [extractedOcrText, setExtractedOcrText] = useState('');
  const [ocrSuccessNotice, setOcrSuccessNotice] = useState('');
  const [ocrParsedData, setOcrParsedData] = useState(null);

  useEffect(() => {
    loadBrands();
  }, []);

  // Update auto-calculated features for Social Profile
  useEffect(() => {
    const u = socialForm.username || '';
    const f = socialForm.fullname || '';
    const uDigits = (u.match(/\d/g) || []).length;
    const fDigits = (f.match(/\d/g) || []).length;
    const uRatio = u.length > 0 ? parseFloat((uDigits / u.length).toFixed(3)) : 0;
    const fRatio = f.length > 0 ? parseFloat((fDigits / f.length).toFixed(3)) : 0;
    const fWords = f.trim() ? f.trim().split(/\s+/).length : 0;
    const nameEquals = u.toLowerCase() === f.toLowerCase() ? 1 : 0;

    setSocialForm((prev) => ({
      ...prev,
      nums_length_username: uRatio,
      nums_length_fullname: fRatio,
      fullname_words: fWords,
      name_equals_username: nameEquals,
    }));
  }, [socialForm.username, socialForm.fullname]);

  // Real-time computed URL features
  const computedUrlFeatures = (() => {
    const raw = (urlForm.url || '').trim();
    const url_length = raw.length;
    const num_dots = (raw.match(/\./g) || []).length;
    const num_hyphens = (raw.match(/-/g) || []).length;
    const num_slashes = (raw.match(/\//g) || []).length;
    const num_digits = (raw.match(/\d/g) || []).length;
    const has_at_symbol = raw.includes('@') ? 1 : 0;

    let has_ip = 0;
    let suspicious_tld = 0;
    try {
      const parsed = new URL(raw.startsWith('http') ? raw : `http://${raw}`);
      const host = parsed.hostname || '';
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) has_ip = 1;
      const tld = host.split('.').pop()?.toLowerCase();
      const suspList = [
        'top', 'xyz', 'work', 'click', 'loan', 'gq', 'cf', 'tk', 'ml', 'ga',
        'buzz', 'fit', 'surf', 'icu', 'bar', 'rest', 'cam', 'kim', 'party', 'cc'
      ];
      if (suspList.includes(tld)) suspicious_tld = 1;
    } catch {
      // fallback
    }

    const keywords = ['login', 'verify', 'account', 'secure', 'update', 'banking', 'wallet', 'unlock', 'claim', 'bonus', 'auth', 'signin'];
    const lower = raw.toLowerCase();
    const scam_keywords = keywords.some((kw) => lower.includes(kw)) ? 1 : 0;

    return {
      url_length,
      num_dots,
      num_hyphens,
      num_slashes,
      num_digits,
      has_at_symbol,
      has_ip,
      suspicious_tld,
      scam_keywords,
    };
  })();

  // Real-time computed Scam Text features
  const computedTextStats = (() => {
    const text = scamTextForm.text || '';
    const message_length = text.length;
    const urls = (text.match(/https?:\/\/\S+|www\.\S+|bit\.ly\/\S+/gi) || []);
    const url_count = urls.length;
    const scam_keywords = ['urgent', 'immediately', 'suspended', 'locked', 'blocked', 'password', 'pin', 'otp', 'cvv', 'bank account', 'verify', 'winner', 'won', 'lottery', 'reward', 'crypto', 'airdrop'];
    const lower = text.toLowerCase();
    const keyword_count = scam_keywords.filter((kw) => lower.includes(kw)).length;
    return { message_length, url_count, keyword_count };
  })();

  const loadBrands = async () => {
    try {
      const data = await api.listBrands();
      if (Array.isArray(data)) {
        setBrands(data);
        if (data.length > 0 && !socialForm.brandId) {
          const firstId = data[0]._id;
          setSocialForm((prev) => ({ ...prev, brandId: firstId }));
          setBrandPageForm((prev) => ({ ...prev, brandId: firstId }));
          setAppForm((prev) => ({ ...prev, brandId: firstId, brand_name: data[0].name }));
          setUrlForm((prev) => ({ ...prev, brandId: firstId }));
        }
      }
    } catch (e) {
      console.warn('Could not load brands:', e);
    }
  };

  // Run Social Profile Detection
  const handleSocialSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await api.detectSocialProfile(socialForm);
      setResult(res.detection);
    } catch (err) {
      setError(err.message || 'Detection failed');
    } finally {
      setLoading(false);
    }
  };

  // Run Brand Page Detection
  const handleBrandPageSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await api.detectBrandPage(brandPageForm);
      setResult(res.detection);
    } catch (err) {
      setError(err.message || 'Detection failed');
    } finally {
      setLoading(false);
    }
  };

  // Run Scam Text Detection
  const handleScamTextSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await api.detectScamText(scamTextForm);
      setResult(res.detection);
    } catch (err) {
      setError(err.message || 'Detection failed');
    } finally {
      setLoading(false);
    }
  };

  // Run Mobile App Detection
  const handleAppSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await api.detectMobileApp(appForm);
      setResult(res.detection);
    } catch (err) {
      setError(err.message || 'Detection failed');
    } finally {
      setLoading(false);
    }
  };

  // Run URL Detection
  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const payload = {
        url: urlForm.url,
        check_rules: urlForm.check_rules,
        use_ml: urlForm.use_ml,
        brandId: urlForm.brandId,
      };

      if (urlForm.manualOverride) {
        payload.features = urlForm.features;
      }

      const res = await api.detectUrl(payload);
      setResult(res.detection);
    } catch (err) {
      setError(err.message || 'Detection failed');
    } finally {
      setLoading(false);
    }
  };

  // Helper to convert file to Base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  // OCR File Upload & Backend Multer Processing with Autofill and Real-time Prediction
  const processOcrFile = async (file, targetModel = null) => {
    if (!file) return;
    setOcrImage(file);
    setOcrPreview(URL.createObjectURL(file));
    setExtractedOcrText('');
    setOcrSuccessNotice('');
    setLoading(true);
    setError('');
    setOcrProgress({ status: 'Uploading screenshot to Backend Multer OCR...', progress: 0.2 });

    try {
      const activeDestination = targetModel || (activeTab !== 'ocr_scanner' ? activeTab : 'auto');

      // Create Multer multipart FormData payload with extractOnly=true
      const formData = new FormData();
      formData.append('image', file);
      formData.append('detectorType', activeDestination);
      formData.append('extractOnly', 'true');
      const bId = socialForm.brandId || urlForm.brandId || appForm.brandId;
      if (bId) formData.append('brandId', bId);
      if (appForm.brand_name) formData.append('brandName', appForm.brand_name);

      setOcrProgress({ status: 'Vision AI: Extracting text & autofilling model fields...', progress: 0.6 });

      // Call Backend Universal Multer OCR endpoint
      const backendRes = await api.processOcrAndDetect(formData);

      setOcrProgress({ status: 'Form autofilled! Ready to execute.', progress: 1.0 });

      if (backendRes && backendRes.autofillInputs) {
        const { detectorType: detectedType, rawText, autofillInputs } = backendRes;
        const cleanText = (rawText || '').trim();
        setExtractedOcrText(cleanText);

        // Autofill form inputs in real time based on active tab / detected type
        if (activeDestination === 'social_profile' || detectedType === 'social_profile') {
          setSocialForm((prev) => ({
            ...prev,
            username: autofillInputs.username || prev.username,
            fullname: autofillInputs.fullname || prev.fullname,
            profile_pic: autofillInputs.profile_pic ?? prev.profile_pic,
            nums_length_username: autofillInputs.nums_length_username ?? prev.nums_length_username,
            fullname_words: autofillInputs.fullname_words ?? prev.fullname_words,
            nums_length_fullname: autofillInputs.nums_length_fullname ?? prev.nums_length_fullname,
            name_equals_username: autofillInputs.name_equals_username ?? prev.name_equals_username,
            description_length: autofillInputs.description_length ?? prev.description_length,
            external_url: autofillInputs.external_url ?? prev.external_url,
            private: autofillInputs.private ?? prev.private,
            posts: autofillInputs.posts ?? prev.posts,
            followers: autofillInputs.followers ?? prev.followers,
            follows: autofillInputs.follows ?? prev.follows,
          }));
          setOcrSuccessNotice(`✓ Extracted & Autofilled @${autofillInputs.username || 'account'}. Click "Execute Evaluation" below to run model.`);
        } else if (activeDestination === 'scam_text' || detectedType === 'scam_text') {
          setScamTextForm((prev) => ({
            ...prev,
            text: autofillInputs.text || cleanText,
            platform: autofillInputs.platform || prev.platform,
          }));
          setOcrSuccessNotice(`✓ Message text extracted & autofilled! Click "Execute NLP Scam Inference" below.`);
        } else if (activeDestination === 'url' || detectedType === 'url') {
          setUrlForm((prev) => ({
            ...prev,
            url: autofillInputs.url || prev.url,
            manualOverride: false,
          }));
          setOcrSuccessNotice(`✓ URL extracted & autofilled! Click "Execute Evaluation" below.`);
        } else if (activeDestination === 'mobile_app' || detectedType === 'mobile_app') {
          setAppForm((prev) => ({
            ...prev,
            app_name: autofillInputs.app_name || prev.app_name,
            developer_name: autofillInputs.developer_name || prev.developer_name,
            package_name: autofillInputs.package_name || prev.package_name,
            store_url: autofillInputs.store_url || prev.store_url,
            brand_name: autofillInputs.brand_name || prev.brand_name,
            risk_threshold: autofillInputs.risk_threshold || prev.risk_threshold,
          }));
          setOcrSuccessNotice(`✓ Mobile app parameters autofilled! Click "Inspect Rogue App Signatures" below.`);
        }

        // 2. SET RESULT FOR REAL-TIME DOSSIER DISPLAY
        if (detection) {
          setResult(detection);
        }
      }
    } catch (err) {
      console.error('OCR API call failed:', err);
      setError(err.response?.data?.error?.message || err.message || 'OCR extraction via API failed');
    } finally {
      setLoading(false);
      setOcrProgress(null);
    }
  };

  const handleImageUpload = (e, targetModel = null) => {
    const file = e.target.files?.[0];
    if (file) {
      processOcrFile(file, targetModel);
    }
  };

  const handleFileDrop = (e, targetModel = null) => {
    e.preventDefault();
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processOcrFile(file, targetModel);
    }
  };

  // Run Social Profile RF Prediction directly from OCR
  const handleRunOcrSocialPrediction = async () => {
    if (!ocrParsedData?.social) {
      setError('No parsed profile data available. Please upload a profile screenshot.');
      return;
    }
    const f = ocrParsedData.social.features;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await api.detectSocialProfile({
        ...socialForm,
        username: ocrParsedData.social.meta.username,
        fullname: ocrParsedData.social.meta.fullname,
        description: ocrParsedData.social.meta.bio,
        profile_pic: f['profile pic'],
        nums_length_username: f['nums/length username'],
        fullname_words: f['fullname words'],
        nums_length_fullname: f['nums/length fullname'],
        name_equals_username: f['name==username'],
        description_length: f['description length'],
        external_url: f['external URL'],
        private: f['private'],
        posts: f['#posts'],
        followers: f['#followers'],
        follows: f['#follows'],
      });
      setResult(res.detection);
    } catch (err) {
      setError(err.message || 'Social profile detection failed');
    } finally {
      setLoading(false);
    }
  };

  // Run Scam NLP Prediction directly from OCR
  const handleRunOcrScamPrediction = async () => {
    const textToAnalyze = (scamTextForm.text || extractedOcrText || '').trim();
    if (!textToAnalyze) {
      setError('No text detected or entered to evaluate. Please upload a screenshot or enter message text.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await api.detectScamText({
        ...scamTextForm,
        text: textToAnalyze,
      });
      setResult(res.detection);
    } catch (err) {
      setError(err.message || 'Scam text detection failed');
    } finally {
      setLoading(false);
    }
  };

  // Run Phishing URL RF Prediction directly from OCR
  const handleRunOcrUrlPrediction = async () => {
    if (!ocrParsedData?.phishing?.url) {
      setError('No URL detected in OCR text. Please check the URL field.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await api.detectUrl({
        url: ocrParsedData.phishing.url,
        check_rules: true,
        use_ml: true,
        brandId: urlForm.brandId,
        features: ocrParsedData.phishing.features,
      });
      setResult(res.detection);
    } catch (err) {
      setError(err.message || 'Phishing URL detection failed');
    } finally {
      setLoading(false);
    }
  };

  // Run Rogue Mobile App Engine directly from OCR
  const handleRunOcrAppPrediction = async () => {
    if (!ocrParsedData?.mobile) {
      setError('No mobile app details detected in OCR. Please check inputs.');
      return;
    }
    const m = ocrParsedData.mobile;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await api.detectMobileApp({
        ...appForm,
        app_name: m.appName,
        developer_name: m.developerName,
        package_name: m.packageName,
        store_url: m.storeUrl,
        brand_name: m.brandName,
        official_package_name: m.officialPackageName,
        official_developer_name: m.officialDeveloperName,
        risk_threshold: m.riskThreshold,
      });
      setResult(res.detection);
    } catch (err) {
      setError(err.message || 'Mobile app detection failed');
    } finally {
      setLoading(false);
    }
  };

  // Export Threat Dossier as JSON
  const handleExportDossier = () => {
    if (!result) return;
    const reportData = {
      platform: 'RiskProtect Enterprise SOC',
      reportGeneratedAt: new Date().toISOString(),
      detectionId: result._id,
      detectorType: result.detectorType || activeTab,
      verdict: result.verdict,
      riskScore: result.riskScore,
      riskBand: result.riskBand,
      modelVersion: result.modelVersion,
      scoreProvenance: result.scoreProvenance,
      reasonCodes: result.reasonCodes || [],
      evidence: result.evidence || [],
      submittedInput: result.submittedInput,
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threat-dossier-${result._id || Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getRiskColor = (band) => {
    const b = (band || '').toLowerCase();
    if (b === 'critical') return 'var(--risk-critical)';
    if (b === 'high') return 'var(--risk-high)';
    if (b === 'medium') return 'var(--risk-medium)';
    return 'var(--risk-low)';
  };

  const activeSpec = MODEL_SPECS[specModalKey];

  return (
    <div>
      {/* Top Header */}
      <div className="section-header">
        <div>
          <h2 className="section-title">Threat Detection Engines & OCR Scanner</h2>
          <p className="section-subtitle">
            A digital risk protection workspace for reviewing suspicious accounts, messages, apps and links.
          </p>
        </div>

        {/* Global Spec Quick-Inspect */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setSpecModalKey(activeTab in MODEL_SPECS ? activeTab : 'social_profile')}
          title="Review check details"
        >
          <BookOpen size={15} color="var(--accent-indigo)" />
          <span>Check requirements</span>
        </button>
      </div>

      {/* Detector Selector Tabs */}
      <div className="detector-tabs-bar">
        <button
          className={`detector-tab-btn ${activeTab === 'social_profile' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('social_profile');
            setResult(null);
          }}
        >
          <UserX size={16} />
          <span>1. Social Profile</span>
        </button>

        <button
          className={`detector-tab-btn ${activeTab === 'brand_page' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('brand_page');
            setResult(null);
          }}
        >
          <Globe size={16} />
          <span>2. Brand Page Rules</span>
        </button>

        <button
          className={`detector-tab-btn ${activeTab === 'scam_text' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('scam_text');
            setResult(null);
          }}
        >
          <MessageSquare size={16} />
          <span>3. Scam text</span>
        </button>

        <button
          className={`detector-tab-btn ${activeTab === 'mobile_app' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('mobile_app');
            setResult(null);
          }}
        >
          <Smartphone size={16} />
          <span>4. Rogue Mobile App</span>
        </button>

        <button
          className={`detector-tab-btn ${activeTab === 'url' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('url');
            setResult(null);
          }}
        >
          <ShieldAlert size={16} />
          <span>5. Website links</span>
        </button>
      </div>

      {error && <div className="alert-box alert-error" style={{ marginBottom: 20 }}>{error}</div>}

      {/* Main Grid: Form Left, Result Right */}
      <div className="detector-grid">
        {/* Left: Input Form */}
        <div className="glass-panel" style={{ padding: 24 }}>
          {/* TAB 1: SOCIAL PROFILE */}
          {activeTab === 'social_profile' && (
            <form onSubmit={handleSocialSubmit}>
              <div className="form-legend" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4>1. Fake Social Profile Detection Engine</h4>
                  <p>Review the account details shown in the screenshot before taking action.</p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSpecModalKey('social_profile')}
                  style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                >
                  <Info size={13} /> View Spec
                </button>
              </div>

              {/* Direct Screenshot OCR Dropzone inside Social Profile Tab */}
              <div
                className="ocr-dropzone"
                style={{ marginBottom: 16, padding: '14px 16px', background: '#f8fafc', border: '1.5px dashed var(--border-subtle)', borderRadius: 8 }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleFileDrop(e, 'social_profile')}
              >
                <input
                  type="file"
                  id="social-ocr-file-input"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handleImageUpload(e, 'social_profile')}
                />
                <label htmlFor="social-ocr-file-input" className="ocr-upload-label" style={{ cursor: 'pointer', textAlign: 'center', display: 'block' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <FileUp size={20} color="var(--primary-color)" />
                    <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                      📸 Drop Instagram / Twitter profile screenshot to auto-extract 11 features via OCR
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Automatically detects @handle, name, followers, following, posts, external URL & calculates digit ratios
                  </span>
                </label>
              </div>

              {ocrProgress && activeTab === 'social_profile' && (
                <div style={{ marginBottom: 16, background: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 600 }}>
                    <span>{ocrProgress.status}</span>
                    <span>{Math.round((ocrProgress.progress || 0) * 100)}%</span>
                  </div>
                  <div className="progress-bar-wrap" style={{ marginTop: 6 }}>
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${Math.round((ocrProgress.progress || 0) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {ocrSuccessNotice && activeTab === 'social_profile' && (
                <div className="alert-box alert-success" style={{ marginBottom: 16, fontSize: '0.82rem', padding: '10px 14px' }}>
                  {ocrSuccessNotice}
                </div>
              )}

              {/* Real-time Computed Feature Helper */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  marginBottom: 16,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 12,
                  fontSize: '0.78rem',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>nums/length username:</span>{' '}
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{socialForm.nums_length_username}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>fullname words:</span>{' '}
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{socialForm.fullname_words}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>nums/length fullname:</span>{' '}
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{socialForm.nums_length_fullname}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>name == username:</span>{' '}
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{socialForm.name_equals_username}</strong>
                </div>
              </div>

              <div className="form-group-grid">
                <div>
                  <label className="field-label">Target Username (Handle)</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    value={socialForm.username}
                    onChange={(e) => setSocialForm({ ...socialForm, username: e.target.value })}
                  />
                </div>

                <div>
                  <label className="field-label">Display Full Name</label>
                  <input
                    type="text"
                    className="input-field"
                    value={socialForm.fullname}
                    onChange={(e) => setSocialForm({ ...socialForm, fullname: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group-grid" style={{ marginTop: 14 }}>
                <div>
                  <label className="field-label">#followers</label>
                  <input
                    type="number"
                    className="input-field"
                    value={socialForm.followers}
                    onChange={(e) => setSocialForm({ ...socialForm, followers: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
                <div>
                  <label className="field-label">#follows (Following)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={socialForm.follows}
                    onChange={(e) => setSocialForm({ ...socialForm, follows: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
                <div>
                  <label className="field-label">#posts</label>
                  <input
                    type="number"
                    className="input-field"
                    value={socialForm.posts}
                    onChange={(e) => setSocialForm({ ...socialForm, posts: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
                <div>
                  <label className="field-label">Description Length</label>
                  <input
                    type="number"
                    className="input-field"
                    value={socialForm.description_length}
                    onChange={(e) => setSocialForm({ ...socialForm, description_length: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
              </div>

              <div className="form-group-grid" style={{ marginTop: 14 }}>
                <div>
                  <label className="field-label">Profile Pic (0/1)</label>
                  <select
                    className="input-field"
                    value={socialForm.profile_pic}
                    onChange={(e) => setSocialForm({ ...socialForm, profile_pic: parseInt(e.target.value, 10) })}
                  >
                    <option value={1}>1 - Picture Present</option>
                    <option value={0}>0 - Default Avatar</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">External URL (0/1)</label>
                  <select
                    className="input-field"
                    value={socialForm.external_url}
                    onChange={(e) => setSocialForm({ ...socialForm, external_url: parseInt(e.target.value, 10) })}
                  >
                    <option value={1}>1 - URL in Bio</option>
                    <option value={0}>0 - No External Link</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Private Account (0/1)</label>
                  <select
                    className="input-field"
                    value={socialForm.private}
                    onChange={(e) => setSocialForm({ ...socialForm, private: parseInt(e.target.value, 10) })}
                  >
                    <option value={0}>0 - Public Account</option>
                    <option value={1}>1 - Private Account</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} disabled={loading}>
                {loading ? <Loader2 size={16} className="spin" /> : <UserX size={16} />}
                Check this profile
              </button>
            </form>
          )}

          {/* TAB 2: BRAND PAGE */}
          {activeTab === 'brand_page' && (
            <form onSubmit={handleBrandPageSubmit}>
              <div className="form-legend" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4>Brand Page Impersonation Heuristics</h4>
                  <p>Cross-references page name, external domains, and customer support claims with official brand registry.</p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSpecModalKey('brand_page')}
                  style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                >
                  <Info size={13} /> View Spec
                </button>
              </div>

              <div className="form-group-grid">
                <div>
                  <label className="field-label">Page Name</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    value={brandPageForm.pageName}
                    onChange={(e) => setBrandPageForm({ ...brandPageForm, pageName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Social Platform</label>
                  <select
                    className="input-field"
                    value={brandPageForm.platform}
                    onChange={(e) => setBrandPageForm({ ...brandPageForm, platform: e.target.value })}
                  >
                    <option value="facebook">Facebook</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="twitter">X / Twitter</option>
                    <option value="telegram">Telegram Channel</option>
                  </select>
                </div>
              </div>

              <div className="form-group-grid" style={{ marginTop: 14 }}>
                <div>
                  <label className="field-label">Handle / Vanity URL</label>
                  <input
                    type="text"
                    className="input-field"
                    value={brandPageForm.handle}
                    onChange={(e) => setBrandPageForm({ ...brandPageForm, handle: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Followers Count</label>
                  <input
                    type="number"
                    className="input-field"
                    value={brandPageForm.followerCount}
                    onChange={(e) => setBrandPageForm({ ...brandPageForm, followerCount: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <label className="field-label">Claimed External Website</label>
                <input
                  type="text"
                  className="input-field"
                  value={brandPageForm.claimedWebsite}
                  onChange={(e) => setBrandPageForm({ ...brandPageForm, claimedWebsite: e.target.value })}
                />
              </div>

              <div style={{ marginTop: 14 }}>
                <label className="field-label">Bio / Description (Pretexting check)</label>
                <textarea
                  rows={2}
                  className="input-field"
                  value={brandPageForm.bio}
                  onChange={(e) => setBrandPageForm({ ...brandPageForm, bio: e.target.value })}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} disabled={loading}>
                {loading ? <Loader2 size={16} className="spin" /> : <Globe size={16} />}
                Verify Against Brand Registry
              </button>
            </form>
          )}

          {/* TAB 3: SCAM TEXT NLP */}
          {activeTab === 'scam_text' && (
            <form onSubmit={handleScamTextSubmit}>
              <div className="form-legend" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4>2. Scam Text Detection Pipeline</h4>
                  <p>Review the message warning signs alongside the original conversation.</p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSpecModalKey('scam_text')}
                  style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                >
                  <Info size={13} /> View Spec
                </button>
              </div>

              {/* Direct Screenshot OCR Dropzone inside Scam Text Tab */}
              <div
                className="ocr-dropzone"
                style={{ marginBottom: 16, padding: '14px 16px', background: '#f8fafc', border: '1.5px dashed var(--border-subtle)', borderRadius: 8 }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleFileDrop(e, 'scam_text')}
              >
                <input
                  type="file"
                  id="scam-ocr-file-input"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handleImageUpload(e, 'scam_text')}
                />
                <label htmlFor="scam-ocr-file-input" className="ocr-upload-label" style={{ cursor: 'pointer', textAlign: 'center', display: 'block' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <FileUp size={20} color="var(--primary-color)" />
                    <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                      📸 Drop screenshot here or click to auto-extract text via OCR
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Supports SMS screenshots, WhatsApp chats, email snippets, or social bios
                  </span>
                </label>
              </div>

              {ocrProgress && activeTab === 'scam_text' && (
                <div style={{ marginBottom: 16, background: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 600 }}>
                    <span>{ocrProgress.status}</span>
                    <span>{Math.round((ocrProgress.progress || 0) * 100)}%</span>
                  </div>
                  <div className="progress-bar-wrap" style={{ marginTop: 6 }}>
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${Math.round((ocrProgress.progress || 0) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {ocrSuccessNotice && activeTab === 'scam_text' && (
                <div className="alert-box alert-success" style={{ marginBottom: 16, fontSize: '0.82rem', padding: '10px 14px' }}>
                  {ocrSuccessNotice}
                </div>
              )}

              {/* Real-time Computed Text Stats */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  marginBottom: 10,
                  display: 'flex',
                  gap: 16,
                  fontSize: '0.78rem',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>message_length:</span>{' '}
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{computedTextStats.message_length} chars</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>url_count:</span>{' '}
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{computedTextStats.url_count}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>keyword_count:</span>{' '}
                  <strong style={{ fontFamily: 'var(--font-mono)', color: computedTextStats.keyword_count > 0 ? '#ef4444' : 'inherit' }}>
                    {computedTextStats.keyword_count} triggers
                  </strong>
                </div>
              </div>

              <div>
                <label className="field-label">Suspicious Message Body or Bio Text (Input Field: text)</label>
                <textarea
                  rows={5}
                  required
                  className="input-field"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem' }}
                  value={scamTextForm.text}
                  onChange={(e) => setScamTextForm({ ...scamTextForm, text: e.target.value })}
                />
              </div>

              <div className="form-group-grid" style={{ marginTop: 14 }}>
                <div>
                  <label className="field-label">Origin Channel</label>
                  <select
                    className="input-field"
                    value={scamTextForm.platform}
                    onChange={(e) => setScamTextForm({ ...scamTextForm, platform: e.target.value })}
                  >
                    <option value="sms">SMS / Smishing</option>
                    <option value="whatsapp">WhatsApp / Telegram</option>
                    <option value="instagram_bio">Instagram Bio</option>
                    <option value="email">Email Phishing Text</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} disabled={loading}>
                {loading ? <Loader2 size={16} className="spin" /> : <MessageSquare size={16} />}
                Check message
              </button>
            </form>
          )}



          {/* TAB 4: ROGUE MOBILE APP */}
          {activeTab === 'mobile_app' && (
            <form onSubmit={handleAppSubmit}>
              <div className="form-legend" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4>4. Fake Mobile Application Detection Engine</h4>
                  <p>Compare the listing with your official app and developer details.</p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSpecModalKey('mobile_app')}
                  style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                >
                  <Info size={13} /> View Spec
                </button>
              </div>

              {/* Direct Screenshot OCR Dropzone inside Mobile App Tab */}
              <div
                className="ocr-dropzone"
                style={{ marginBottom: 16, padding: '14px 16px', background: '#f8fafc', border: '1.5px dashed var(--border-subtle)', borderRadius: 8 }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleFileDrop(e, 'mobile_app')}
              >
                <input
                  type="file"
                  id="mobile-ocr-file-input"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handleImageUpload(e, 'mobile_app')}
                />
                <label htmlFor="mobile-ocr-file-input" className="ocr-upload-label" style={{ cursor: 'pointer', textAlign: 'center', display: 'block' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <FileUp size={20} color="var(--primary-color)" />
                    <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                      📸 Drop Google Play / App Store screenshot to auto-extract App Title, Dev & Package ID
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Auto-detects app name, publisher entity, package namespace, and cross-references registered brands
                  </span>
                </label>
              </div>

              {ocrProgress && activeTab === 'mobile_app' && (
                <div style={{ marginBottom: 16, background: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 600 }}>
                    <span>{ocrProgress.status}</span>
                    <span>{Math.round((ocrProgress.progress || 0) * 100)}%</span>
                  </div>
                  <div className="progress-bar-wrap" style={{ marginTop: 6 }}>
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${Math.round((ocrProgress.progress || 0) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {ocrSuccessNotice && activeTab === 'mobile_app' && (
                <div className="alert-box alert-success" style={{ marginBottom: 16, fontSize: '0.82rem', padding: '10px 14px' }}>
                  {ocrSuccessNotice}
                </div>
              )}

              <div className="form-group-grid">
                <div>
                  <label className="field-label">App Title (app_name)</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    value={appForm.app_name}
                    onChange={(e) => setAppForm({ ...appForm, app_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Package Name (package_name)</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    style={{ fontFamily: 'var(--font-mono)' }}
                    value={appForm.package_name}
                    onChange={(e) => setAppForm({ ...appForm, package_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group-grid" style={{ marginTop: 14 }}>
                <div>
                  <label className="field-label">Developer Name (developer_name)</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    value={appForm.developer_name}
                    onChange={(e) => setAppForm({ ...appForm, developer_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Target Brand (brand_name)</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    value={appForm.brand_name}
                    onChange={(e) => setAppForm({ ...appForm, brand_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group-grid" style={{ marginTop: 14 }}>
                <div>
                  <label className="field-label">Suspected app logo</label>
                  <input type="file" className="input-field" accept="image/png,image/jpeg,image/webp" onChange={async event=>{const file=event.target.files?.[0];if(!file)return;try{setAppForm(current=>({...current,suspected_logo_fingerprint:await imageFingerprint(file)}));}catch(err){setError(err.message);}}}/>
                  <small className="section-subtitle">Compared automatically with the registered official logo fingerprint.</small>
                  {appForm.suspected_logo_fingerprint&&<p className="upload-requirements">Suspected logo ready for comparison.</p>}
                </div>
                <div>
                  <label className="field-label">Official Package (official_package_name)</label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ fontFamily: 'var(--font-mono)' }}
                    value={appForm.official_package_name}
                    onChange={(e) => setAppForm({ ...appForm, official_package_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Official Developer (official_developer_name)</label>
                  <input
                    type="text"
                    className="input-field"
                    value={appForm.official_developer_name}
                    onChange={(e) => setAppForm({ ...appForm, official_developer_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group-grid" style={{ marginTop: 14 }}>
                <div>
                  <label className="field-label">Distribution Store (store_url)</label>
                  <input
                    type="text"
                    className="input-field"
                    value={appForm.store_url}
                    onChange={(e) => setAppForm({ ...appForm, store_url: e.target.value })}
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label className="field-label">Risk Threshold (risk_threshold)</label>
                    <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      {appForm.risk_threshold}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    className="input-field"
                    style={{ padding: 0 }}
                    value={appForm.risk_threshold}
                    onChange={(e) => setAppForm({ ...appForm, risk_threshold: parseInt(e.target.value, 10) })}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} disabled={loading}>
                {loading ? <Loader2 size={16} className="spin" /> : <Smartphone size={16} />}
                Inspect Rogue App Signatures (Rules Engine)
              </button>
            </form>
          )}

          {/* TAB 5: PHISHING URL */}
          {activeTab === 'url' && (
            <form onSubmit={handleUrlSubmit}>
              <div className="form-legend" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4>3. Phishing URL Detection Engine</h4>
                  <p>Review the website address before opening or sharing it.</p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSpecModalKey('url')}
                  style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                >
                  <Info size={13} /> View Spec
                </button>
              </div>

              {/* Direct Screenshot OCR Dropzone inside Phishing URL Tab */}
              <div
                className="ocr-dropzone"
                style={{ marginBottom: 16, padding: '14px 16px', background: '#f8fafc', border: '1.5px dashed var(--border-subtle)', borderRadius: 8 }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleFileDrop(e, 'url')}
              >
                <input
                  type="file"
                  id="url-ocr-file-input"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handleImageUpload(e, 'url')}
                />
                <label htmlFor="url-ocr-file-input" className="ocr-upload-label" style={{ cursor: 'pointer', textAlign: 'center', display: 'block' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <FileUp size={20} color="var(--primary-color)" />
                    <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                      📸 Drop Browser Address Bar or Link screenshot to auto-extract URL via OCR
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Extracts URL, automatically computes 9 structural features and enables model execution
                  </span>
                </label>
              </div>

              {ocrProgress && activeTab === 'url' && (
                <div style={{ marginBottom: 16, background: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 600 }}>
                    <span>{ocrProgress.status}</span>
                    <span>{Math.round((ocrProgress.progress || 0) * 100)}%</span>
                  </div>
                  <div className="progress-bar-wrap" style={{ marginTop: 6 }}>
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${Math.round((ocrProgress.progress || 0) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {ocrSuccessNotice && activeTab === 'url' && (
                <div className="alert-box alert-success" style={{ marginBottom: 16, fontSize: '0.82rem', padding: '10px 14px' }}>
                  {ocrSuccessNotice}
                </div>
              )}

              <div>
                <label className="field-label">Target URL (Raw String)</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  style={{ fontFamily: 'var(--font-mono)' }}
                  value={urlForm.url}
                  onChange={(e) => setUrlForm({ ...urlForm, url: e.target.value })}
                />
              </div>

              {/* Real-time 9-Feature Breakdown Grid */}
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Live Extracted 9 Model Features:
                  </span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={urlForm.manualOverride}
                      onChange={(e) => setUrlForm({ ...urlForm, manualOverride: e.target.checked })}
                    />
                    <span>Manual Feature Vector Override</span>
                  </label>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 8,
                    background: '#f8fafc',
                    padding: 12,
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.78rem',
                  }}
                >
                  {[
                    { key: 'url_length', label: 'url_length', val: computedUrlFeatures.url_length },
                    { key: 'num_dots', label: 'num_dots', val: computedUrlFeatures.num_dots },
                    { key: 'num_hyphens', label: 'num_hyphens', val: computedUrlFeatures.num_hyphens },
                    { key: 'num_slashes', label: 'num_slashes', val: computedUrlFeatures.num_slashes },
                    { key: 'num_digits', label: 'num_digits', val: computedUrlFeatures.num_digits },
                    { key: 'has_at_symbol', label: 'has_at_symbol', val: computedUrlFeatures.has_at_symbol },
                    { key: 'has_ip', label: 'has_ip', val: computedUrlFeatures.has_ip },
                    { key: 'suspicious_tld', label: 'suspicious_tld', val: computedUrlFeatures.suspicious_tld },
                    { key: 'scam_keywords', label: 'scam_keywords', val: computedUrlFeatures.scam_keywords },
                  ].map((f) => (
                    <div
                      key={f.key}
                      style={{
                        background: '#ffffff',
                        padding: '6px 8px',
                        borderRadius: 6,
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ color: 'var(--text-muted)' }}>{f.label}:</span>
                      {urlForm.manualOverride ? (
                        <input
                          type="number"
                          style={{
                            width: 50,
                            padding: '2px 4px',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.75rem',
                            border: '1px solid #cbd5e1',
                            borderRadius: 4,
                          }}
                          value={urlForm.features[f.key] ?? f.val}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setUrlForm((prev) => ({
                              ...prev,
                              features: { ...prev.features, [f.key]: val },
                            }));
                          }}
                        />
                      ) : (
                        <strong style={{ fontFamily: 'var(--font-mono)', color: f.val > 0 && ['has_ip', 'suspicious_tld', 'scam_keywords'].includes(f.key) ? '#ef4444' : 'inherit' }}>
                          {f.val}
                        </strong>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 20, marginTop: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={urlForm.check_rules}
                    onChange={(e) => setUrlForm({ ...urlForm, check_rules: e.target.checked })}
                  />
                  <span>Run Lexical & Typosquat Rules</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={urlForm.use_ml}
                    onChange={(e) => setUrlForm({ ...urlForm, use_ml: e.target.checked })}
                  />
                  <span>Check website link</span>
                </label>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} disabled={loading}>
                {loading ? <Loader2 size={16} className="spin" /> : <ShieldAlert size={16} />}
                Analyze Phishing Vector (9 Numeric Features)
              </button>
            </form>
          )}
        </div>

        {/* Right: Results Display Panel */}
        <div className="glass-panel result-panel" style={{ padding: 24 }}>
          <div className="section-header" style={{ marginBottom: 16 }}>
            <div>
              <h3 className="section-title">Inference Result & Evidence</h3>
              <p className="section-subtitle">Real-time risk score, provenance, and forensic signals</p>
            </div>
            {result && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleExportDossier}
                title="Download JSON Threat Dossier"
                style={{ fontSize: '0.78rem' }}
              >
                <Download size={14} /> Dossier
              </button>
            )}
          </div>

          {result ? (
            <div className="result-content">
              {/* Score Meter & Verdict */}
              {(() => {
                const displayScore =
                  typeof result.riskScore === 'number'
                    ? result.riskScore
                    : result.riskScore != null
                    ? Number(result.riskScore)
                    : 0;
                const displayProvenance =
                  !result.scoreProvenance || result.scoreProvenance.includes('undefined')
                    ? `Inference risk assessment: ${displayScore}% confidence`
                    : result.scoreProvenance;

                const isFakeOrScam =
                  result.verdict?.toLowerCase().includes('fake') ||
                  result.verdict?.toLowerCase().includes('scam') ||
                  result.verdict?.toLowerCase().includes('phishing') ||
                  result.verdict?.toLowerCase().includes('impersonat');

                return (
                  <>
                    <div className="result-score-box" style={{ borderColor: getRiskColor(result.riskBand) }}>
                      <div className="score-circle" style={{ borderColor: getRiskColor(result.riskBand) }}>
                        <span className="score-num">{displayScore}</span>
                        <span className="score-total">/100</span>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span
                            className={`badge badge-${(result.riskBand || 'low').toLowerCase()}`}
                            style={{ fontSize: '0.85rem' }}
                          >
                            {result.riskBand || 'Assessed'} Risk
                          </span>
                          <span
                            className={`badge ${isFakeOrScam ? 'badge-critical' : 'badge-low'}`}
                            style={{ fontSize: '0.82rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}
                          >
                            Target Class: {isFakeOrScam ? '1 (Fake)' : '0 (Real / Genuine)'}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            v{result.modelVersion || '1.0.0'}
                          </span>
                        </div>
                        <h4
                          style={{
                            fontSize: '1.35rem',
                            marginTop: 6,
                            fontWeight: 800,
                            color: isFakeOrScam ? '#dc2626' : '#16a34a',
                          }}
                        >
                          {result.verdict || (isFakeOrScam ? 'Fake Profile' : 'Real / Genuine Profile')}
                        </h4>
                      </div>
                    </div>

                    {/* Provenance */}
                    <div className="result-meta-item">
                      <span className="meta-label">Score Provenance:</span>
                      <span className="meta-value">{displayProvenance}</span>
                    </div>
                  </>
                );
              })()}

              {/* Reason Codes */}
              {result.reasonCodes && result.reasonCodes.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div className="meta-label" style={{ marginBottom: 6 }}>
                    Triggered Reason Codes:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {result.reasonCodes.map((code, idx) => (
                      <span key={idx} className="badge badge-neutral" style={{ fontFamily: 'var(--font-mono)' }}>
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Forensic Evidence Checklist - Clear Categorical Points */}
              {result.evidence && result.evidence.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <div
                    className="meta-label"
                    style={{
                      marginBottom: 10,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.85rem' }}>
                      Forensic Evidence Checklist ({result.evidence.length} Points Detected):
                    </span>
                    <span className="badge badge-warning" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                      Verified Signal Audit
                    </span>
                  </div>
                  <div className="evidence-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {result.evidence.map((ev, idx) => {
                      let category = '';
                      let pattern = '';
                      let detail = '';

                      if (typeof ev === 'string') {
                        pattern = ev;
                      } else if (typeof ev === 'object' && ev !== null) {
                        category = ev.category || ev.type || ev.field || '';
                        pattern = ev.pattern || ev.finding || ev.assessment || ev.description || '';
                        if (ev.field && ev.assessment) {
                          category = ev.field;
                          pattern = ev.assessment;
                        }
                        if (ev.value !== undefined) {
                          detail = `Value: ${ev.value}`;
                        }
                        // If still empty pattern, synthesize clean summary
                        if (!pattern) {
                          pattern = Object.entries(ev)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' • ');
                        }
                      }

                      // Convert category from snake_case to Title Case
                      const formattedCategory = category
                        ? category
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, (c) => c.toUpperCase())
                        : 'Threat Indicator';

                      return (
                        <div
                          key={idx}
                          className="evidence-item"
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 12,
                            padding: '12px 14px',
                            background: '#fff7ed',
                            border: '1px solid #fed7aa',
                            borderRadius: 8,
                          }}
                        >
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: '#ffedd5',
                              color: '#ea580c',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              marginTop: 1,
                            }}
                          >
                            <AlertCircle size={15} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.04em',
                                  background: '#ea580c',
                                  color: '#ffffff',
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                }}
                              >
                                {formattedCategory}
                              </span>
                              {detail && (
                                <span style={{ fontSize: '0.74rem', color: '#9a3412', fontFamily: 'var(--font-mono)' }}>
                                  ({detail})
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.86rem', color: '#7c2d12', fontWeight: 500, lineHeight: 1.45 }}>
                              {pattern}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Escalate to Case */}
              <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    if (onEscalateToCase) onEscalateToCase(result);
                  }}
                >
                  <ShieldAlert size={16} />
                  Escalate to Incident Case
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleExportDossier}
                  title="Export Threat Dossier (JSON)"
                >
                  <Download size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-result-state">
              <ShieldAlert size={48} color="#94a3b8" />
              <p style={{ marginTop: 14, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Select a threat vector on the left and click "Execute Evaluation" to view real-time model inference, risk score, and signals.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Model Spec & Feature Contract Modal */}
      {specModalKey && activeSpec && (
        <div
          className="modal-backdrop"
          onClick={() => setSpecModalKey(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            className="glass-panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 780,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: 12,
              padding: 28,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Cpu size={20} color="var(--primary-color)" />
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{activeSpec.title}</h3>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span>Check category: <strong style={{ color: 'var(--text-main)' }}>{activeSpec.title}</strong></span>
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSpecModalKey(null)}
                style={{ padding: 6, borderRadius: '50%' }}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ marginTop: 14, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {activeSpec.description}
            </p>

            <div style={{ marginTop: 16, background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
              <strong>Target Class Mapping:</strong> <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary-color)', marginLeft: 8 }}>{activeSpec.classes}</code>
            </div>

            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: 22, marginBottom: 12 }}>
              Verified Input Parameters & Feature Specification:
            </h4>

            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                <thead style={{ background: '#f1f5f9', borderBottom: '1px solid var(--border-subtle)' }}>
                  <tr>
                    <th style={{ padding: '8px 12px', fontWeight: 700 }}>Input Field</th>
                    <th style={{ padding: '8px 12px', fontWeight: 700 }}>Data Type</th>
                    <th style={{ padding: '8px 12px', fontWeight: 700 }}>Meaning & Range</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSpec.features.map((f, i) => (
                    <tr key={i} style={{ borderBottom: i < activeSpec.features.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary-color)' }}>
                        {f.name}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                        {f.type}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                        {f.desc}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 22, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setSpecModalKey(null)}>
                Close Specification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
