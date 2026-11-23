import axios from 'axios';

export const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8081').replace(/\/$/, '');
const TOKEN_KEY = 'aegis_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const http = axios.create({ baseURL: BASE_URL, timeout: 90000 });

// Attach the JWT to every dashboard request.
http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// An expired or invalid token anywhere (except the login form itself) logs the user out.
http.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    const isAuthForm = url.startsWith('/auth/login') || url.startsWith('/auth/register');
    if (err.response?.status === 401 && !isAuthForm) {
      window.dispatchEvent(new CustomEvent('aegis:unauthorized'));
    }
    return Promise.reject(err);
  },
);

// Turns any axios error into one readable sentence (handles the backend's zod "details" list too).
export function errorMessage(err) {
  if (!err.response) {
    return err.code === 'ECONNABORTED'
      ? 'The request timed out. Please try again.'
      : `Cannot reach the backend at ${BASE_URL}. Is it running?`;
  }
  const data = err.response.data || {};
  if (Array.isArray(data.details) && data.details.length) {
    return data.details.map((d) => (d.path ? `${d.path}: ${d.message}` : d.message)).join(' · ');
  }
  return data.error || `Request failed (${err.response.status})`;
}

const get = (url, config) => http.get(url, config).then((r) => r.data);
const post = (url, body, config) => http.post(url, body, config).then((r) => r.data);
const del = (url) => http.delete(url).then((r) => r.data);

// ---- Auth ----
export const authApi = {
  register: (body) => post('/auth/register', body),
  login: (body) => post('/auth/login', body),
  me: () => get('/auth/me'),
};

// ---- Teams (create/members are ADMIN only) ----
export const teamsApi = {
  list: () => get('/teams'),
  create: (name) => post('/teams', { name }),
  members: (teamId) => get(`/teams/${teamId}/members`),
  addMember: (teamId, body) => post(`/teams/${teamId}/members`, body),
  removeMember: (teamId, userId) => del(`/teams/${teamId}/members/${userId}`),
};

// ---- Applications, gateway keys, analytics, logs ----
export const appsApi = {
  list: () => get('/applications'),
  create: (body) => post('/applications', body),
  issueKey: (appId, label) => post(`/applications/${appId}/keys`, { label }),
  keys: (appId) => get(`/applications/${appId}/keys`),
  revokeKey: (appId, keyId) => del(`/applications/${appId}/keys/${keyId}`),
  analytics: (appId) => get(`/applications/${appId}/analytics`),
  logs: (appId, limit = 50) => get(`/applications/${appId}/logs`, { params: { limit } }),
};

// ---- Provider keys / BYOK (ADMIN only) ----
export const providerKeysApi = {
  list: () => get('/provider-keys'),
  add: (body) => post('/provider-keys', body),
  remove: (id) => del(`/provider-keys/${id}`),
};

// ---- Health (public) ----
// 503 still carries a useful body, so don't treat it as an error.
export const healthApi = {
  get: () => http.get('/health', { validateStatus: () => true }).then((r) => r.data),
};

// ---- Gateway (authenticated with an application's API key, not the JWT) ----
export const gatewayApi = {
  chat: (apiKey, body) =>
    axios
      .post(`${BASE_URL}/v1/chat/completions`, body, { headers: { 'x-api-key': apiKey }, timeout: 90000 })
      .then((r) => r.data),
};
