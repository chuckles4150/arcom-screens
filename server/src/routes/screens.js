// Two routers under one module:
//   - dashboard: full CRUD, requires password
//   - piClient: heartbeat + screenshot upload, no password

import express from 'express';
import multer from 'multer';
import {
  getScreens, getScreen, addScreen, updateScreen, deleteScreen,
  logActivity, getActivity, getSnapshotAt, SCREENSHOTS_DIR,
  appendMetricSample, getLatestMetricSample, getMetricSamples,
  clearMetricSamples,
  LOG_SOURCES, appendLogLines, getLogLines, clearLogBuffers,
} from '../storage.js';
import { computeUptime, parseWindow } from '../uptime.js';
import { computeMetricsWindow, parseMetricsWindow } from '../metrics.js';

// ── Dashboard (auth'd) ───────────────────────────────────────────

const dashboard = express.Router();

async function decorateWithSnapshot(screen) {
  return { ...screen, snapshotAt: await getSnapshotAt(screen.hostname) };
}

dashboard.get('/', async (req, res) => {
  const screens = await Promise.all(getScreens().map(decorateWithSnapshot));
  res.json({ screens });
});

dashboard.get('/:id', async (req, res) => {
  const screen = getScreen(req.params.id);
  if (!screen) return res.status(404).json({ error: 'not found' });
  res.json(await decorateWithSnapshot(screen));
});

// Per-screen uptime % + daily history sparkline. Pure derivation from the
// activity log + current state — no new storage. ?window=Nd (default 7d).
dashboard.get('/:id/uptime', (req, res) => {
  const screen = getScreen(req.params.id);
  if (!screen) return res.status(404).json({ error: 'not found' });
  const days = parseWindow(req.query.window) || 7;
  const result = computeUptime(getActivity(), screen, { now: new Date(), days });
  res.json(result);
});

// Phase 2: per-screen rolling metrics — bandwidth, restarts, response time,
// load, memory. Derived from the heartbeat sample ring buffer + activity log
// (boot events). ?window=24h | 7d (default 24h).
dashboard.get('/:id/metrics', (req, res) => {
  const screen = getScreen(req.params.id);
  if (!screen) return res.status(404).json({ error: 'not found' });
  const window = parseMetricsWindow(req.query.window) || { hours: 24 };
  const samples = getMetricSamples(screen.id);
  const result = computeMetricsWindow(samples, getActivity(), screen.name, {
    now: new Date(), window,
  });
  res.json(result);
});

// Phase 3: live Pi logs. Pi piggybacks fresh lines on the heartbeat; this
// endpoint returns whatever has accumulated in the in-memory ring buffer
// since the caller's last `lastIdx`. `?source=journal|dmesg|syslog`.
dashboard.get('/:id/logs', (req, res) => {
  const screen = getScreen(req.params.id);
  if (!screen) return res.status(404).json({ error: 'not found' });
  const source = String(req.query.source || 'journal');
  if (!LOG_SOURCES.includes(source)) {
    return res.status(400).json({ error: 'unknown source', allowed: LOG_SOURCES });
  }
  const sinceIdx = parseInt(req.query.since, 10) || 0;
  res.json(getLogLines(screen.id, source, sinceIdx));
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
  await clearMetricSamples(removed.id);
  clearLogBuffers(removed.id);
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

// Reboot detection grace: ignore uptime "going backwards" by less than this.
// Allows for measurement noise + heartbeat-cadence delays.
const REBOOT_GRACE_SEC = 60;

piClient.post('/heartbeat', async (req, res) => {
  const { hostname, currentUrl, metrics, logs } = req.body;
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

  // Phase 2: ingest metrics, detect reboots, append to ring buffer.
  if (metrics && typeof metrics === 'object') {
    const prev = getLatestMetricSample(screen.id);
    const prevUp = prev?.systemUptimeSec;
    const currUp = metrics.systemUptimeSec;

    if (Number.isFinite(prevUp) && Number.isFinite(currUp) &&
        currUp + REBOOT_GRACE_SEC < prevUp) {
      const downtimeSec = Math.max(0, Math.floor((now.getTime() - prev.ts) / 1000) - currUp);
      await logActivity({
        type: 'boot',
        screen: screen.name,
        user: 'system',
        detail: `Pi rebooted (was up ${formatUptime(prevUp)}, downtime ~${formatUptime(downtimeSec)})`,
      });
    }

    await appendMetricSample(screen.id, { ts: now.getTime(), ...metrics });
  }

  // Phase 3: log lines piggyback on the heartbeat. Append per-source.
  if (logs && typeof logs === 'object') {
    for (const source of LOG_SOURCES) {
      const lines = logs[source];
      if (Array.isArray(lines) && lines.length > 0) {
        appendLogLines(screen.id, source, lines);
      }
    }
  }

  res.json({
    id: screen.id,
    name: screen.name,
    urls: screen.urls,
    refresh: screen.refresh,
    forceRefreshAt: screen.forceRefreshAt || null,
  });
});

function formatUptime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '?';
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

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
