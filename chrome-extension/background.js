const DEFAULT_API = 'https://my-website-th9l.onrender.com/api/v1';
const CACHE_TTL = 6 * 60 * 60 * 1000;
const MAX_CACHE_ITEMS = 300;
const inflightChecks = new Map();

const storageGet = keys => chrome.storage.local.get(keys);
const storageSet = values => chrome.storage.local.set(values);

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    return url.toString();
  } catch { return null; }
}

function cacheKey(url) { return `scan:${url}`; }

async function settings() {
  const data = await storageGet(['apiBase', 'token', 'user', 'autoProtect']);
  return { apiBase: (data.apiBase || DEFAULT_API).replace(/\/$/, ''), token: data.token || '', user: data.user || null, autoProtect: data.autoProtect !== false };
}

async function apiRequest(path, options = {}) {
  const config = await settings();
  const response = await fetch(`${config.apiBase}${path}`, {
    ...options,
    headers: { Accept: 'application/json', ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}), ...options.headers }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error?.message || body?.message || `Request failed (${response.status})`);
    error.status = response.status;
    if (response.status === 401) await chrome.storage.local.remove(['token', 'user']);
    throw error;
  }
  return body.data ?? body;
}

async function login(email, password) {
  const config = await settings();
  const response = await fetch(`${config.apiBase}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ email, password }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || 'Sign in failed');
  const data = body.data ?? body;
  await storageSet({ token: data.token, user: data.user });
  return data.user;
}

async function addBlockRule(url) {
  const host = new URL(url).hostname;
  if (!host) return;
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const same = existing.find(rule => rule.condition?.urlFilter === `||${host}^`);
  if (same) return;
  const used = new Set(existing.map(rule => rule.id));
  let id = 1;
  while (used.has(id)) id += 1;
  await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [{ id, priority: 1, action: { type: 'block' }, condition: { urlFilter: `||${host}^`, resourceTypes: ['main_frame'] } }] });
}

async function checkUrl(rawUrl, force = false) {
  const url = normalizeUrl(rawUrl);
  if (!url) throw new Error('Choose a complete HTTP or HTTPS link.');
  const config = await settings();
  if (!config.token) return { status: 'signed_out', url };
  const key = cacheKey(url);
  if (!force) {
    const cached = (await storageGet(key))[key];
    if (cached && Date.now() - cached.checkedAt < CACHE_TTL) return { ...cached, cached: true };
  }
  const form = new FormData();
  form.append('detectorType', 'url');
  form.append('url', url);
  const data = await apiRequest('/workspace/scan', { method: 'POST', body: form });
  const detection = data.detection;
  const result = { status: 'checked', url, checkedAt: Date.now(), detection: { id: detection._id, verdict: detection.verdict, riskScore: detection.riskScore, riskBand: detection.riskBand, limitations: detection.limitations } };
  await storageSet({ [key]: result, lastResult: result });
  const all = await storageGet(null);
  const cacheEntries = Object.entries(all).filter(([name]) => name.startsWith('scan:')).sort((a,b) => (b[1].checkedAt || 0) - (a[1].checkedAt || 0));
  if (cacheEntries.length > MAX_CACHE_ITEMS) await chrome.storage.local.remove(cacheEntries.slice(MAX_CACHE_ITEMS).map(([name]) => name));
  if (['High', 'Critical'].includes(detection.riskBand)) await addBlockRule(url);
  return result;
}

async function migrateConnectionSettings() {
  const current = await storageGet(['apiBase', 'autoProtect']);
  const apiBase = !current.apiBase || /127\.0\.0\.1:5000|localhost:5000/.test(current.apiBase)
    ? DEFAULT_API
    : current.apiBase;
  await storageSet({ apiBase, autoProtect: current.autoProtect !== false });
}

chrome.runtime.onInstalled.addListener(() => migrateConnectionSettings());
chrome.runtime.onStartup.addListener(() => migrateConnectionSettings());

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message.type === 'GET_STATE') return settings();
    if (message.type === 'LOGIN') return { user: await login(message.email, message.password) };
    if (message.type === 'LOGOUT') { await chrome.storage.local.remove(['token', 'user']); return { ok: true }; }
    if (message.type === 'SET_SETTINGS') { await storageSet(message.values); return settings(); }
    if (message.type === 'CHECK_URL') {
      const normalized = normalizeUrl(message.url);
      if (!normalized) throw new Error('Choose a complete HTTP or HTTPS link.');
      if (!message.force && inflightChecks.has(normalized)) return inflightChecks.get(normalized);
      const task = checkUrl(normalized, Boolean(message.force)).finally(() => inflightChecks.delete(normalized));
      inflightChecks.set(normalized, task);
      return task;
    }
    if (message.type === 'GET_LAST_RESULT') return (await storageGet('lastResult')).lastResult || null;
    if (message.type === 'CLEAR_BLOCKS') { const rules = await chrome.declarativeNetRequest.getDynamicRules(); await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: rules.map(rule => rule.id) }); return { ok: true }; }
    if (message.type === 'ALLOW_ONCE') {
      const url = normalizeUrl(message.url);
      if (!url) throw new Error('Invalid destination.');
      const host = new URL(url).hostname;
      const rules = await chrome.declarativeNetRequest.getDynamicRules();
      const matching = rules.filter(rule => rule.condition?.urlFilter === `||${host}^`);
      if (matching.length) await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: matching.map(rule => rule.id) });
      setTimeout(() => addBlockRule(url).catch(() => {}), 15000);
      return { ok: true };
    }
    throw new Error('Unknown extension request.');
  })().then(data => sendResponse({ ok: true, data })).catch(error => sendResponse({ ok: false, error: error.message, status: error.status }));
  return true;
});
