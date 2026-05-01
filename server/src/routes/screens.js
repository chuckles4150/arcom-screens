// Two routers under one module:
//   - dashboard: full CRUD, requires password
//   - piClient: heartbeat + screenshot upload, no password

import express from 'express';
import multer from 'multer';
import {
  getScreens, getScreen, addScreen, updateScreen, deleteScreen,
  logActivity, SCREENSHOTS_DIR,
} from '../storage.js';

// ── Dashboard (auth'd) ───────────────────────────────────────────

const dashboard = express.Router();

dashboard.get('/', (req, res) => {
  res.json({ screens: getScreens() });
});

dashboard.get('/:id', (req, res) => {
  const screen = getScreen(req.params.id);
  if (!screen) return res.status(404).json({ error: 'not found' });
  res.json(screen);
});

dashboard.post('/', async (req, res) => {
  const { name, hostname, ip, urls, refresh, location } = req.body;
  if (!name || !hostname || !urls || urls.length === 0) {
    return res.status(400).json({ error: 'missing required fields' });
  }
  const id = `screen-${Date.now()}`;
  const screen = {
    id,
    name,
    hostname,
    ip: ip || '',
    urls,
    refresh: refresh || 10,
    location: location || '',
    status: 'offline',
    lastSeen: null,
    uptime: '—',
    createdAt: new Date().toISOString(),
  };
  await addScreen(screen);
  await logActivity({ type: 'add', screen: name, user: 'Chuck', detail: 'Screen registered' });
  res.status(201).json(screen);
});

dashboard.put('/:id', async (req, res) => {
  const before = getScreen(req.params.id);
  if (!before) return res.status(404).json({ error: 'not found' });

  const { name, urls, refresh, location } = req.body;
  const patch = {};
  const changes = [];

  if (name !== undefined && name !== before.name) {
    patch.name = name;
    changes.push(`Name: ${before.name} → ${name}`);
  }
  if (refresh !== undefined && refresh !== before.refresh) {
    patch.refresh = refresh;
    changes.push(`Refresh interval: ${before.refresh}m → ${refresh}m`);
  }
  if (location !== undefined && location !== before.location) {
    patch.location = location;
    changes.push('Location updated');
  }
  if (urls !== undefined && JSON.stringify(urls) !== JSON.stringify(before.urls)) {
    patch.urls = urls;
    if (urls.length !== before.urls.length) {
      changes.push(`URL count: ${before.urls.length} → ${urls.length}`);
    } else {
      changes.push('URLs/durations updated');
    }
  }

  const updated = await updateScreen(req.params.id, patch);
  for (const change of changes) {
    await logActivity({ type: 'edit', screen: updated.name, user: 'Chuck', detail: change });
  }
  res.json(updated);
});

dashboard.delete('/:id', async (req, res) => {
  const removed = await deleteScreen(req.params.id);
  if (!removed) return res.status(404).json({ error: 'not found' });
  await logActivity({ type: 'remove', screen: removed.name, user: 'Chuck', detail: 'Screen removed' });
  res.json({ ok: true });
});

// Force a screen to refresh on its next heartbeat.
dashboard.post('/:id/refresh', async (req, res) => {
  const screen = getScreen(req.params.id);
  if (!screen) return res.status(404).json({ error: 'not found' });
  await updateScreen(req.params.id, { forceRefreshAt: Date.now() });
  await logActivity({ type: 'refresh', screen: screen.name, user: 'Chuck', detail: 'Force refresh sent' });
  res.json({ ok: true });
});

// ── Pi client (no auth) ──────────────────────────────────────────

const piClient = express.Router();

piClient.post('/heartbeat', async (req, res) => {
  const { hostname, currentUrl } = req.body;
  if (!hostname) return res.status(400).json({ error: 'missing hostname' });

  const screen = getScreens().find(s => s.hostname === hostname);
  if (!screen) {
    return res.status(404).json({ error: 'screen not registered', hostname });
  }

  const now = new Date();
  const wasOffline = screen.status === 'offline';

  await updateScreen(screen.id, {
    status: 'online',
    lastSeen: now.toISOString(),
    ip: req.ip.replace(/^::ffff:/, '') || screen.ip,
    currentUrl: currentUrl || screen.urls[0]?.url,
  });

  if (wasOffline) {
    await logActivity({ type: 'online', screen: screen.name, user: 'system', detail: 'Came online' });
  }

  res.json({
    id: screen.id,
    name: screen.name,
    urls: screen.urls,
    refresh: screen.refresh,
    forceRefreshAt: screen.forceRefreshAt || null,
  });
});

const upload = multer({
  storage: multer.diskStorage({
    destination: SCREENSHOTS_DIR,
    filename: (req, file, cb) => {
      const hostname = req.body.hostname || 'unknown';
      cb(null, `${hostname}.png`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

piClient.post('/screenshot', upload.single('screenshot'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  res.json({ ok: true, path: `/screenshots/${req.file.filename}` });
});

export const screensRouter = { dashboard, piClient };
