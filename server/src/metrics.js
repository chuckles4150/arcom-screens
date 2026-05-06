// Pure aggregation over per-screen metric samples (collected by the Pi
// heartbeat) plus the activity log (for boot-event derived restart counts).
//
// Deliberately stateless and pure for unit-testability — same shape as
// uptime.js. Inputs in, derived window out.

const MIN_30 = 30 * 60_000;
const HOUR = 3600_000;
const DAY = 86_400_000;

export function parseMetricsWindow(s) {
  if (!s) return null;
  const m = /^(\d+)([hdH])$/.exec(String(s).trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (m[2].toLowerCase() === 'h') return { hours: n };
  return { hours: n * 24 };
}

// Detect Pi reboots in a sample stream by spotting uptime resets between
// consecutive samples. Returns the boot timestamps (ms) within [sinceMs, now].
//
// A reboot is detected when the next sample's systemUptimeSec is *less* than
// the previous sample's by more than 60s of grace (allowing for clock jitter
// and heartbeat-cadence delays).
export function detectReboots(samplesNewestFirst, sinceMs = 0) {
  if (!samplesNewestFirst || samplesNewestFirst.length < 2) return [];
  // Walk oldest → newest so we can compare uptime against the previous sample.
  const samples = samplesNewestFirst.slice().reverse();
  const reboots = [];
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const curr = samples[i];
    const prevUp = prev?.systemUptimeSec;
    const currUp = curr?.systemUptimeSec;
    if (!Number.isFinite(prevUp) || !Number.isFinite(currUp)) continue;
    // Allow up to 60s of measurement noise.
    if (currUp + 60 < prevUp) {
      // Reboot happened somewhere between prev.ts and curr.ts. Best estimate:
      // curr.ts minus current uptime.
      const bootAt = curr.ts - currUp * 1000;
      if (bootAt >= sinceMs) reboots.push(bootAt);
    }
  }
  return reboots;
}

// Bucket a [sinceMs, now] window into N equal-width buckets and reduce
// per-bucket using `reduce(samplesInBucket)`.
function bucketSamples(samples, sinceMs, now, buckets, reduce) {
  const span = now - sinceMs;
  const width = span / buckets;
  const out = new Array(buckets).fill(null);
  if (span <= 0) return out;
  // Sort oldest first so we can sweep linearly.
  const sorted = samples.slice().sort((a, b) => a.ts - b.ts);
  let cursor = 0;
  for (let b = 0; b < buckets; b++) {
    const start = sinceMs + b * width;
    const end = b === buckets - 1 ? now : sinceMs + (b + 1) * width;
    const inBucket = [];
    while (cursor < sorted.length && sorted[cursor].ts < end) {
      if (sorted[cursor].ts >= start) inBucket.push(sorted[cursor]);
      cursor++;
    }
    out[b] = reduce(inBucket);
  }
  return out;
}

// Bandwidth: sum of byte deltas across each bucket (rx + tx separately).
// For each bucket: take consecutive sample pairs, compute the byte delta
// where both are in-bucket. Resets (e.g. nic flap, reboot) show as negative
// deltas → clamped to zero.
function bandwidthReducer(field) {
  return (samples) => {
    if (samples.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < samples.length; i++) {
      const d = (samples[i][field] ?? 0) - (samples[i - 1][field] ?? 0);
      if (d > 0) total += d;
    }
    return total;
  };
}

function avg(samples, field) {
  if (samples.length === 0) return null;
  let sum = 0;
  let n = 0;
  for (const s of samples) {
    if (Number.isFinite(s[field])) { sum += s[field]; n++; }
  }
  return n ? sum / n : null;
}

function percentile(samples, field, p) {
  const xs = samples.map(s => s[field]).filter(Number.isFinite).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const idx = Math.min(xs.length - 1, Math.max(0, Math.floor((p / 100) * xs.length)));
  return xs[idx];
}

// Main entry: compute every metric the dashboard renders for one screen.
//
// samples            : per-screen ring buffer (newest-first).
// activity           : full activity log (newest-first); only `boot` and
//                      `offline` events for `screenName` are read here, but
//                      we accept the full array for symmetry with uptime.js.
// screenName         : used to filter activity.
// opts.now           : Date — defaults to now.
// opts.window        : { hours: N } — how far back to compute. Default 24h.
// opts.bucketsHourly : true → one bucket per hour (history.length == hours).
//                      false → 7 daily buckets when window is 7d. Default
//                      auto: hourly for ≤48h windows, daily for >48h.
export function computeMetricsWindow(samples, activity, screenName, opts = {}) {
  const now = opts.now ? new Date(opts.now).getTime() : Date.now();
  const hours = opts.window?.hours ?? 24;
  const sinceMs = now - hours * HOUR;
  const useHourly = opts.bucketsHourly ?? hours <= 48;
  const buckets = useHourly ? hours : Math.ceil(hours / 24);

  const inWindow = (samples || []).filter(s => s.ts >= sinceMs && s.ts <= now);
  const latest = (samples || [])[0] || null;

  // Bandwidth — bytes per bucket
  const rxHistory = bucketSamples(inWindow, sinceMs, now, buckets,
    bandwidthReducer('bandwidthRxBytes')).map(b => b ?? 0);
  const txHistory = bucketSamples(inWindow, sinceMs, now, buckets,
    bandwidthReducer('bandwidthTxBytes')).map(b => b ?? 0);
  const rxTotal = rxHistory.reduce((a, b) => a + b, 0);
  const txTotal = txHistory.reduce((a, b) => a + b, 0);

  // Restart count — derived from boot events (logged when reboot is
  // detected at heartbeat). Always pull a 7d window for the "Restarts · 7d"
  // card regardless of opts.window.
  const since7d = now - 7 * DAY;
  const bootEvents = (activity || [])
    .filter(e => e?.screen === screenName && e?.type === 'boot')
    .map(e => new Date(e.timestamp).getTime())
    .filter(t => t >= since7d && t <= now)
    .sort((a, b) => a - b);
  const restartHistory = new Array(7).fill(0);
  for (const t of bootEvents) {
    const dayIdx = Math.min(6, Math.max(0, 6 - Math.floor((now - t) / DAY)));
    restartHistory[dayIdx]++;
  }

  // Response time (heartbeat round-trip lag, self-reported by Pi)
  const lagSamples = inWindow.filter(s => Number.isFinite(s.lastLagMs) && s.lastLagMs > 0);
  const lagHistory = bucketSamples(lagSamples, sinceMs, now, buckets,
    samples => avg(samples, 'lastLagMs')).map(v => v ?? null);
  const lagP50 = percentile(lagSamples, 'lastLagMs', 50);
  const lagP95 = percentile(lagSamples, 'lastLagMs', 95);

  // Load + memory (cheap snapshot from latest sample, plus avg over window)
  const loadHistory = bucketSamples(inWindow, sinceMs, now, buckets,
    samples => avg(samples, 'loadAvg1m')).map(v => v ?? null);
  const loadAvg = avg(inWindow, 'loadAvg1m');

  return {
    bandwidth: {
      rxBytes24h: rxTotal,
      txBytes24h: txTotal,
      totalBytes24h: rxTotal + txTotal,
      rxHistory,
      txHistory,
    },
    restarts: {
      total7d: bootEvents.length,
      history: restartHistory,
      bootTimestamps: bootEvents.map(t => new Date(t).toISOString()),
    },
    responseTime: {
      p50Ms: lagP50,
      p95Ms: lagP95,
      history: lagHistory,
    },
    load: {
      avg: loadAvg,
      history: loadHistory,
    },
    memory: latest ? {
      usedMb: latest.memUsedMb ?? null,
      totalMb: latest.memTotalMb ?? null,
    } : { usedMb: null, totalMb: null },
    samplesInWindow: inWindow.length,
    bucketSpan: useHourly ? 'hour' : 'day',
  };
}
