// Aggregate network-wide metrics for the dashboard hero strip.
// One call returns counts + 7-day sparklines so the dashboard doesn't have
// to fan out per-screen uptime requests on every poll.

import express from 'express';
import { getScreens, getActivity } from '../storage.js';
import { computeUptime } from '../uptime.js';

export const networkRouter = express.Router();

networkRouter.get('/summary', (req, res) => {
  const screens = getScreens();
  const activity = getActivity();
  const now = new Date();
  const days = 7;

  const counts = {
    total: screens.length,
    online: screens.filter(s => s.status === 'online').length,
    offline: screens.filter(s => s.status === 'offline').length,
    rotating: screens.filter(s => (s.urls?.length || 0) > 1).length,
  };

  // Per-screen uptime histories. Each is a number[7] (oldest → newest).
  const perScreenHistory = screens.map(s => computeUptime(activity, s, { now, days }));

  // Online history (sparkline): average daily uptime across all screens.
  const onlineHistory = averageHistories(perScreenHistory.map(h => h.history), days);

  // Offline history: count of screens that were < 100% online on each day.
  const offlineHistory = countDaysBelow(perScreenHistory.map(h => h.history), 100, days);

  // Total history: we don't track screen creation/removal timestamps yet, so
  // report the current count flat across the window. (Phase 2 candidate.)
  const totalHistory = Array(days).fill(counts.total);

  // Rotating history: same — snapshot only.
  const rotatingHistory = Array(days).fill(counts.rotating);

  const uptimePct7d = onlineHistory.length
    ? round1(onlineHistory.reduce((a, b) => a + b, 0) / onlineHistory.length)
    : 100;

  res.json({
    counts,
    history: {
      total: totalHistory,
      online: onlineHistory,
      offline: offlineHistory,
      rotating: rotatingHistory,
    },
    uptimePct7d,
  });
});

function averageHistories(histories, days) {
  if (histories.length === 0) return Array(days).fill(0);
  const out = Array(days).fill(0);
  for (let i = 0; i < days; i++) {
    let sum = 0;
    for (const h of histories) sum += (h[i] ?? 0);
    out[i] = round1(sum / histories.length);
  }
  return out;
}

function countDaysBelow(histories, threshold, days) {
  const out = Array(days).fill(0);
  for (let i = 0; i < days; i++) {
    let count = 0;
    for (const h of histories) if ((h[i] ?? 0) < threshold) count++;
    out[i] = count;
  }
  return out;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
