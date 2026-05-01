// Tiny API helper. Adds Authorization header on every call.

const PASSWORD_KEY = 'arcom-screens-password';

export function getStoredPassword() {
  return sessionStorage.getItem(PASSWORD_KEY) || '';
}

export function setStoredPassword(password) {
  sessionStorage.setItem(PASSWORD_KEY, password);
}

export function clearStoredPassword() {
  sessionStorage.removeItem(PASSWORD_KEY);
}

async function request(method, path, body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getStoredPassword()}`,
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(path, opts);
  if (res.status === 401) {
    clearStoredPassword();
    window.location.reload();
    throw new Error('unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  // Try a no-op call to verify password works
  ping: () => request('GET', '/api/screens'),

  listScreens: () => request('GET', '/api/screens').then(d => d.screens),
  getScreen: (id) => request('GET', `/api/screens/${id}`),
  addScreen: (screen) => request('POST', '/api/screens', screen),
  updateScreen: (id, patch) => request('PUT', `/api/screens/${id}`, patch),
  deleteScreen: (id) => request('DELETE', `/api/screens/${id}`),
  refreshScreen: (id) => request('POST', `/api/screens/${id}/refresh`),

  listActivity: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/api/activity${qs ? '?' + qs : ''}`).then(d => d.activity);
  },
};
