// Thin fetch wrapper that injects the dashboard password on every call.
// Password lives in localStorage after the user logs in.

const PASSWORD_KEY = 'arcom-screens-pw';

export function getPassword() {
  return localStorage.getItem(PASSWORD_KEY);
}

export function setPassword(pw) {
  localStorage.setItem(PASSWORD_KEY, pw);
}

export function clearPassword() {
  localStorage.removeItem(PASSWORD_KEY);
}

async function request(path, options = {}) {
  const pw = getPassword();
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(pw ? { Authorization: `Bearer ${pw}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    clearPassword();
    window.location.reload();
    throw new Error('unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth — calls a known-cheap endpoint to verify the password.
  async login(pw) {
    const res = await fetch('/api/screens', {
      headers: { Authorization: `Bearer ${pw}` },
    });
    if (res.ok) {
      setPassword(pw);
      return true;
    }
    return false;
  },

  // Screens
  listScreens: () => request('/api/screens'),
  getScreen: (id) => request(`/api/screens/${id}`),
  addScreen: (screen) => request('/api/screens', { method: 'POST', body: JSON.stringify(screen) }),
  updateScreen: (id, patch) => request(`/api/screens/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
  deleteScreen: (id) => request(`/api/screens/${id}`, { method: 'DELETE' }),
  forceRefresh: (id) => request(`/api/screens/${id}/refresh`, { method: 'POST' }),

  // Activity
  listActivity: () => request('/api/activity'),
};
