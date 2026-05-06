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

  // Phase-1 additions
  networkSummary: () => request('GET', '/api/network/summary'),
  screenUptime: (id, window = '7d') =>
    request('GET', `/api/screens/${id}/uptime?window=${encodeURIComponent(window)}`),

  // Phase-2 additions
  screenMetrics: (id, window = '24h') =>
    request('GET', `/api/screens/${id}/metrics?window=${encodeURIComponent(window)}`),

  // Phase-3 additions
  screenLogs: (id, source, since = 0) =>
    request('GET', `/api/screens/${id}/logs?source=${encodeURIComponent(source)}&since=${since}`),

  // Phase-4: settings + alerts
  getSettings: () => request('GET', '/api/settings'),
  updateSettings: (patch) => request('PUT', '/api/settings', patch),
  sendAlertTest: (body = {}) => request('POST', '/api/settings/alert-test', body),

  // Phase-5: playlists
  listPlaylists: () => request('GET', '/api/playlists').then(d => d.playlists),
  getPlaylist:   (id) => request('GET', `/api/playlists/${id}`),
  addPlaylist:   (playlist) => request('POST', '/api/playlists', playlist),
  updatePlaylist:(id, patch) => request('PUT', `/api/playlists/${id}`, patch),
  deletePlaylist:(id) => request('DELETE', `/api/playlists/${id}`),

  // Phase-6: schedules
  listSchedules: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/api/schedules${qs ? '?' + qs : ''}`).then(d => d.schedules);
  },
  addSchedule:   (schedule) => request('POST', '/api/schedules', schedule),
  updateSchedule:(id, patch) => request('PUT', `/api/schedules/${id}`, patch),
  deleteSchedule:(id) => request('DELETE', `/api/schedules/${id}`),

  // Phase-7: incidents
  listIncidents: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/api/incidents${qs ? '?' + qs : ''}`).then(d => d.incidents);
  },
  getIncident:   (id) => request('GET', `/api/incidents/${id}`),
  updateIncident:(id, patch) => request('PUT', `/api/incidents/${id}`, patch),
  addIncidentNote: (id, text) => request('POST', `/api/incidents/${id}/notes`, { text }),
};
