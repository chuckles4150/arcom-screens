// JSON file storage. Two files: screens.json and activity.json.
// Reads cache on boot; writes are flushed to disk on every change.

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');
const SCREENS_FILE = path.join(DATA_DIR, 'screens.json');
const ACTIVITY_FILE = path.join(DATA_DIR, 'activity.json');
const SCREENSHOTS_DIR = path.join(DATA_DIR, 'screenshots');

const cache = {
  screens: [],
  activity: [],
};

export async function initStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });

  cache.screens = await readJson(SCREENS_FILE, []);
  cache.activity = await readJson(ACTIVITY_FILE, []);

  console.log(`storage: loaded ${cache.screens.length} screens, ${cache.activity.length} activity entries`);
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
