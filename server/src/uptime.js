// Pure derivation: compute per-screen uptime % and a daily history sparkline
// from the activity log. No new storage required — replays online/offline
// events appended by routes/screens.js (heartbeat) and watchdog.js.
//
// Daily buckets are aligned to the server's local midnight. The newest
// bucket is the current (possibly partial) day; the oldest is N-1 days ago.
//
// activity entries: { timestamp: ISO string, type, screen, ... }
//   We care about type === 'online' | 'offline' for entries matching screen.name.
//
// screen: { name, status, lastSeen }  (current state — used as a fallback when
//   the activity log has no events for this screen).

const DAY_MS = 86_400_000;

export function parseWindow(s) {
  if (!s) return null;
  const m = /^(\d+)d$/i.exec(String(s).trim());
  if (!m) return null;
  return parseInt(m[1], 10);
}

export function computeUptime(activity, screen, opts = {}) {
  const now = opts.now ? new Date(opts.now) : new Date();
  const days = Number.isInteger(opts.days) && opts.days > 0 ? opts.days : 7;

  // Local-midnight aligned window: oldest bucket starts at midnight (days-1)
  // days ago, newest bucket runs from today's midnight to `now`.
  const today0 = new Date(now);
  today0.setHours(0, 0, 0, 0);
  const windowStart = today0.getTime() - (days - 1) * DAY_MS;
  const windowEnd = now.getTime();

  // Pull status events for this screen, oldest first.
  const events = (activity || [])
    .filter(a => a && a.screen === screen.name && (a.type === 'online' || a.type === 'offline'))
    .map(a => ({ time: new Date(a.timestamp).getTime(), state: a.type }))
    .filter(e => Number.isFinite(e.time))
    .sort((a, b) => a.time - b.time);

  // State at windowStart = most recent event before/at windowStart, or fall back
  // to current screen.status when there's no history at all (assumes the
  // screen's been in its current state for the whole window).
  let stateAtStart;
  const priors = events.filter(e => e.time <= windowStart);
  if (priors.length > 0) {
    stateAtStart = priors[priors.length - 1].state;
  } else if (events.length === 0) {
    stateAtStart = screen.status === 'online' ? 'online' : 'offline';
  } else {
    // Events exist but all are after windowStart — assume the opposite of
    // the first event, i.e. screen had to enter its first observed state.
    stateAtStart = events[0].state === 'online' ? 'offline' : 'online';
  }

  const eventsInWindow = events.filter(e => e.time > windowStart && e.time <= windowEnd);

  const dailyOnlineMs = new Array(days).fill(0);
  let cursor = windowStart;
  let currentState = stateAtStart;

  for (const ev of eventsInWindow) {
    if (currentState === 'online') {
      addOnlineSegment(cursor, ev.time, windowStart, dailyOnlineMs);
    }
    cursor = ev.time;
    currentState = ev.state;
  }
  // Tail segment from last event to now
  if (currentState === 'online' && cursor < windowEnd) {
    addOnlineSegment(cursor, windowEnd, windowStart, dailyOnlineMs);
  }

  // Convert ms-per-bucket to %.
  const history = dailyOnlineMs.map((ms, i) => {
    const dayStart = windowStart + i * DAY_MS;
    const dayEnd = Math.min(dayStart + DAY_MS, windowEnd);
    const dayDuration = dayEnd - dayStart;
    if (dayDuration <= 0) return 0;
    const pct = (ms / dayDuration) * 100;
    return roundTo1(pct);
  });

  const uptimePct = history.length
    ? roundTo1(history.reduce((a, b) => a + b, 0) / history.length)
    : 0;

  return { uptimePct, history };
}

function addOnlineSegment(start, end, windowStart, dailyOnlineMs) {
  if (end <= start) return;
  const days = dailyOnlineMs.length;
  let cursor = start;
  while (cursor < end) {
    const dayIdx = Math.floor((cursor - windowStart) / DAY_MS);
    if (dayIdx < 0) {
      cursor = windowStart;
      continue;
    }
    if (dayIdx >= days) break;
    const dayBoundary = windowStart + (dayIdx + 1) * DAY_MS;
    const segmentEnd = Math.min(end, dayBoundary);
    dailyOnlineMs[dayIdx] += segmentEnd - cursor;
    cursor = segmentEnd;
  }
}

function roundTo1(n) {
  return Math.round(n * 10) / 10;
}
