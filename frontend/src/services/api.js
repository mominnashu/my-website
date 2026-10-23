// RiskProtect Frontend API Client

export const API_BASE = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.PROD
    ? 'https://my-website-th9l.onrender.com/api/v1'
    : '/api/v1');

export function getToken() {
  return localStorage.getItem('rp_auth_token') || '';
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('rp_auth_token', token);
  } else {
    localStorage.removeItem('rp_auth_token');
  }
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem('rp_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setCurrentUser(user) {
  if (user) {
    localStorage.setItem('rp_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('rp_user');
  }
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.error?.message || data?.message || `HTTP ${response.status} Error`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.details = data?.error?.details || [];
    err.code = data?.error?.code || 'REQUEST_FAILED';
    throw err;
  }

  return data.data !== undefined ? data.data : data;
}

export const api = {
  // Auth
  async login(email, password) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.token) {
      setToken(data.token);
      setCurrentUser(data.user);
    }
    return data;
  },

  async register(payload) {
    const data = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (data.token) {
      setToken(data.token);
      setCurrentUser(data.user);
    }
    return data;
  },

  async me() {
    return request('/auth/me');
  },

  logout() {
    setToken(null);
    setCurrentUser(null);
  },

  // System & Health
  async getHealth() {
    return request('/system/health');
  },

  async getModels() {
    return request('/system/models');
  },

  async getStats() {
    return request('/system/stats');
  },

  async getPlans() { return request('/billing/plans'); },
  async getSubscription() { return request('/billing/subscription'); },
  async changePlan(planId, billingCycle) { return request('/billing/change-plan', { method: 'POST', body: JSON.stringify({ planId, ...(billingCycle ? { billingCycle } : {}) }) }); },
  async ownerLogs() { return request('/billing/owner/logs'); },
  async updateCompany(id, payload) { return request(`/billing/owner/companies/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }); },

  // Brands
  async listBrands() {
    return request('/brands');
  },

  async createBrand(payload) {
    return request('/brands', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async deleteBrand(id) {
    return request(`/brands/${id}`, {
      method: 'DELETE',
    });
  },

  // Threat Detections (5 Engines)
  async detectSocialProfile(payload) {
    return request('/detections/social-profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async detectBrandPage(payload) {
    return request('/detections/brand-page', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async detectScamText(payload) {
    return request('/detections/scam-text', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async detectMobileApp(payload) {
    return request('/detections/mobile-app', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async detectUrl(payload) {
    return request('/detections/url', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async processOcrAndDetect(payloadOrFormData) {
    if (typeof FormData !== 'undefined' && payloadOrFormData instanceof FormData) {
      const token = getToken();
      const response = await fetch(`${API_BASE}/detections/ocr-process`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: payloadOrFormData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error?.message || data?.message || `HTTP ${response.status} Error`);
      }
      return data.data !== undefined ? data.data : data;
    }

    return request('/detections/ocr-process', {
      method: 'POST',
      body: JSON.stringify(payloadOrFormData),
    });
  },

  async listDetections(params = {}) {
    const q = new URLSearchParams(params).toString();
    return request(`/detections${q ? `?${q}` : ''}`);
  },

  async getDetection(id) {
    return request(`/detections/${id}`);
  },

  // Alerts
  async listAlerts(params = {}) {
    const q = new URLSearchParams(params).toString();
    return request(`/alerts${q ? `?${q}` : ''}`);
  },

  async acknowledgeAlert(id) {
    return request(`/alerts/${id}/acknowledge`, {
      method: 'POST',
    });
  },

  async updateAlert(id, payload) {
    return request(`/alerts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  // Cases
  async listCases(params = {}) {
    const q = new URLSearchParams(params).toString();
    return request(`/cases${q ? `?${q}` : ''}`);
  },

  async createCase(payload) {
    return request('/cases', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getCase(id) {
    return request(`/cases/${id}`);
  },

  async updateCase(id, payload) {
    return request(`/cases/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async addCaseNote(id, note) {
    return request(`/cases/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  },

  async attachDetectionToCase(id, detectionId) {
    return request(`/cases/${id}/attach-detection`, {
      method: 'POST',
      body: JSON.stringify({ detectionId }),
    });
  },
};
