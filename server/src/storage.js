// JSON file storage. Three files: screens.json, activity.json, metrics.json.
// Reads cache on boot; writes are flushed to disk on every change.

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');
const SCREENS_FILE = path.join(DATA_DIR, 'screens.json');
const ACTIVITY_FILE = path.join(DATA_DIR, 'activity.json');
const METRICS_FILE = path.join(DATA_DIR, 'metrics.json');
const SCREENSHOTS_DIR = path.join(DATA_DIR, 'screenshots');

// Per-screen ring buffer cap. At 30s heartbeat that's ~42 hours of samples,
// comfortably more than the 24h window the dashboard renders.
const MAX_METRIC_SAMPLES = 5000;

const cache = {
  screens: [],
  activity: [],
  metrics: {}, // screenId → array of samples, newest first
};

export async function initStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });

  cache.screens = await readJson(SCREENS_FILE, []);
  cache.activity = await readJson(ACTIVITY_FILE, []);
  cache.metrics = await readJson(METRICS_FILE, {});

  const sampleCount = Object.values(cache.metrics).reduce((n, arr) => n + arr.length, 0);
  console.log(`storage: loaded ${cache.screens.length} screens, ${cache.activity.length} activity entries, ${sampleCount} metric samples`);
}

async function readJson(file, fallback) {
  try {
    const buf = await fs.readFile(file, 'utf8');
    return JSON.parse(buf);
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function writeJson(file, data) {
  const tmp = file + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, file);
}

// ── Screens ──────────────────────────────────────────────────────

export function getScreens() {
  return cache.screens;
}

export function getScreen(id) {
  return cache.screens.find(s => s.id === id);
}

export async function addScreen(screen) {
  cache.screens.push(screen);
  await writeJson(SCREENS_FILE, cache.screens);
  return screen;
}

export async function updateScreen(id, patch) {
  const idx = cache.screens.findIndex(s => s.id === id);
  if (idx === -1) return null;
  cache.screens[idx] = { ...cache.screens[idx], ...patch };
  await writeJson(SCREENS_FILE, cache.screens);
  return cache.screens[idx];
}

export async function deleteScreen(id) {
  const idx = cache.screens.findIndex(s => s.id === id);
  if (idx === -1) return null;
  const removed = cache.screens.splice(idx, 1)[0];
  await writeJson(SCREENS_FILE, cache.screens);
  return removed;
}

// ── Activity ──────────────────────────────────────────────────────

const MAX_ACTIVITY_ENTRIES = 500;

export function getActivity() {
  return cache.activity;
}

export async function logActivity(entry) {
  const event = {
    id: Date.now() + Math.random(),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  cache.activity.unshift(event);
  if (cache.activity.length > MAX_ACTIVITY_ENTRIES) {
    cache.activity = cache.activity.slice(0, MAX_ACTIVITY_ENTRIES);
  }
  await writeJson(ACTIVITY_FILE, cache.activity);
  return event;
}

export { SCREENSHOTS_DIR };

// ── Snapshot metadata ─────────────────────────────────────────────

// Returns the ISO timestamp of the most recent screenshot for this hostname,
// or null if no screenshot exists yet. Used by the dashboard to render
// "Snap N min ago" without a separate API round-trip.
export async function getSnapshotAt(hostname) {
  if (!hostname) return null;
  try {
    const stat = await fs.stat(path.join(SCREENSHOTS_DIR, `${hostname}.png`));
    return stat.mtime.toISOString();
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

// ── Metric samples ────────────────────────────────────────────────
// Per-screen ring buffer — newest first. Each sample is whatever the
// heartbeat delivered (uptime, bandwidth cumulative bytes, load avg, etc.)
// plus a server-assigned `ts` (ms since epoch) and `recvAt` (ISO).

export function getMetricSamples(screenId, sinceMs = 0) {
  const arr = cache.metrics[screenId] || [];
  if (sinceMs <= 0) return arr;
  return arr.filter(s => s.ts >= sinceMs);
}

export function getLatestMetricSample(screenId) {
  const arr = cache.metrics[screenId];
  return arr && arr.length ? arr[0] : null;
}

export async function appendMetricSample(screenId, sample) {
  if (!screenId || !sample) return null;
  const ts = sample.ts ?? Date.now();
  const enriched = { ts, recvAt: new Date(ts).toISOString(), ...sample };
  if (!cache.metrics[screenId]) cache.metrics[screenId] = [];
  cache.metrics[screenId].unshift(enriched);
  if (cache.metrics[screenId].length > MAX_METRIC_SAMPLES) {
    cache.metrics[screenId].length = MAX_METRIC_SAMPLES;
  }
  await writeJson(METRICS_FILE, cache.metrics);
  return enriched;
}

// Removes a screen's metric history when the screen is deleted.
export async function clearMetricSamples(screenId) {
  if (cache.metrics[screenId]) {
    delete cache.metrics[screenId];
    await writeJson(METRICS_FILE, cache.metrics);
  }
}

// ── Log buffers (Phase 3) ─────────────────────────────────────────
// In-memory only. Per (screen, source) ring buffer of recent log lines.
// Server restart clears them; the next heartbeat refills.
//
// LOG_SOURCES are the values the Pi can send and the dashboard can fetch.
// Anything outside the whitelist is dropped.

export const LOG_SOURCES = ['journal', 'dmesg', 'syslog'];
const MAX_LOG_LINES_PER_SOURCE = 500;

// Internal: { [screenId]: { journal: { lines: [], totalAdded: N }, dmesg: ..., syslog: ... } }
const logBuffers = {};

function getOrInitBuffer(screenId, source) {
  if (!logBuffers[screenId]) logBuffers[screenId] = {};
  if (!logBuffers[screenId][source]) logBuffers[screenId][source] = { lines: [], totalAdded: 0 };
  return logBuffers[screenId][source];
}

// Appends raw log lines for a source. `totalAdded` is a monotonic counter
// the dashboard uses to ask "what's new since I last checked" — it survives
// ring-buffer trims.
export function appendLogLines(screenId, source, lines) {
  if (!screenId || !LOG_SOURCES.includes(source) || !Array.isArray(lines) || lines.length === 0) return;
  const buf = getOrInitBuffer(screenId, source);
  for (const raw of lines) {
    if (typeof raw !== 'string' || raw.length === 0) continue;
    buf.lines.push(raw);
    buf.totalAdded++;
  }
  if (buf.lines.length > MAX_LOG_LINES_PER_SOURCE) {
    buf.lines.splice(0, buf.lines.length - MAX_LOG_LINES_PER_SOURCE);
  }
}

// Returns `{ lines, lastIdx }` where `lastIdx` is the cumulative index of
// the newest line. Pass that back as `sinceIdx` next time to get only what
// arrived in between.
export function getLogLines(screenId, source, sinceIdx = 0) {
  if (!LOG_SOURCES.includes(source)) return { lines: [], lastIdx: 0 };
  const buf = logBuffers[screenId]?.[source];
  if (!buf) return { lines: [], lastIdx: 0 };
  const total = buf.totalAdded;
  const oldestIdxInBuffer = total - buf.lines.length; // first line in `lines` has this cumulative index
  let startIdx;
  if (sinceIdx <= oldestIdxInBuffer) {
    // Caller has fallen behind — give them everything we have.
    startIdx = 0;
  } else {
    startIdx = sinceIdx - oldestIdxInBuffer;
  }
  return {
    lines: buf.lines.slice(startIdx),
    lastIdx: total,
  };
}

export function clearLogBuffers(screenId) {
  if (logBuffers[screenId]) delete logBuffers[screenId];
}
