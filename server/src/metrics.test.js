import { describe, it, expect } from 'vitest';
import { detectReboots, computeMetricsWindow, parseMetricsWindow } from './metrics.js';

const NOW = new Date(2026, 4, 6, 18, 0, 0).getTime(); // 2026-05-06T18:00 local
const HOUR = 3600_000;

function sample(tsOffset, fields) {
  return { ts: NOW + tsOffset, ...fields };
}

describe('parseMetricsWindow', () => {
  it('parses Nh and Nd', () => {
    expect(parseMetricsWindow('24h')).toEqual({ hours: 24 });
    expect(parseMetricsWindow('7d')).toEqual({ hours: 168 });
    expect(parseMetricsWindow('1d')).toEqual({ hours: 24 });
  });
  it('returns null on garbage', () => {
    expect(parseMetricsWindow('')).toBe(null);
    expect(parseMetricsWindow('week')).toBe(null);
    expect(parseMetricsWindow('24')).toBe(null);
  });
});

describe('detectReboots', () => {
  it('returns no reboots when uptime is monotonic', () => {
    const samples = [
      sample(-1 * HOUR, { systemUptimeSec: 7200 }),
      sample(-2 * HOUR, { systemUptimeSec: 3600 }),
      sample(-3 * HOUR, { systemUptimeSec: 0 }),
    ];
    expect(detectReboots(samples)).toEqual([]);
  });

  it('detects a single reboot when uptime drops between samples', () => {
    // Samples newest-first. 2h ago: uptime 7200s; 1h ago: uptime 60s ⇒ reboot in between.
    const samples = [
      sample(-1 * HOUR, { systemUptimeSec: 60 }),
      sample(-2 * HOUR, { systemUptimeSec: 7200 }),
    ];
    const reboots = detectReboots(samples);
    expect(reboots).toHaveLength(1);
    // bootAt = curr.ts - currUp*1000 ≈ now - 1h - 60s
    expect(reboots[0]).toBeCloseTo(NOW - HOUR - 60_000, -3);
  });

  it('ignores tiny uptime jitter under the 60s grace', () => {
    const samples = [
      sample(-1 * HOUR, { systemUptimeSec: 7170 }), // 30s "less" — within grace
      sample(-2 * HOUR, { systemUptimeSec: 7200 }),
    ];
    expect(detectReboots(samples)).toEqual([]);
  });

  it('detects multiple reboots in the window', () => {
    const samples = [
      sample(-1 * HOUR, { systemUptimeSec: 60 }),     // reboot just before this
      sample(-2 * HOUR, { systemUptimeSec: 7200 }),
      sample(-3 * HOUR, { systemUptimeSec: 30 }),     // reboot just before this
      sample(-4 * HOUR, { systemUptimeSec: 14400 }),
    ];
    expect(detectReboots(samples)).toHaveLength(2);
  });

  it('drops reboots before sinceMs', () => {
    const samples = [
      sample(-25 * HOUR, { systemUptimeSec: 60 }),    // reboot ~25h ago
      sample(-30 * HOUR, { systemUptimeSec: 7200 }),
    ];
    const reboots = detectReboots(samples, NOW - 24 * HOUR);
    expect(reboots).toEqual([]);
  });
});

describe('computeMetricsWindow', () => {
  it('zeros out everything when there are no samples', () => {
    const result = computeMetricsWindow([], [], 'pi-x', { now: NOW });
    expect(result.bandwidth.totalBytes24h).toBe(0);
    expect(result.restarts.total7d).toBe(0);
    expect(result.responseTime.p50Ms).toBe(null);
    expect(result.load.avg).toBe(null);
    expect(result.memory.usedMb).toBe(null);
    expect(result.bandwidth.rxHistory).toHaveLength(24);
  });

  it('sums positive byte deltas for bandwidth, ignoring resets', () => {
    // Three samples in the same hour — newest first.
    const samples = [
      sample(-30 * 60_000, { bandwidthRxBytes: 3000, bandwidthTxBytes: 100 }),
      sample(-40 * 60_000, { bandwidthRxBytes: 2000, bandwidthTxBytes: 50  }),
      sample(-50 * 60_000, { bandwidthRxBytes: 1000, bandwidthTxBytes: 0   }),
    ];
    const result = computeMetricsWindow(samples, [], 'pi-x', { now: NOW });
    expect(result.bandwidth.rxBytes24h).toBe(2000); // 1000→2000→3000
    expect(result.bandwidth.txBytes24h).toBe(100);  //   0→50→100
  });

  it('clamps negative deltas (counter resets) to zero', () => {
    const samples = [
      sample(-30 * 60_000, { bandwidthRxBytes: 1000, bandwidthTxBytes: 0 }),
      sample(-40 * 60_000, { bandwidthRxBytes: 9999, bandwidthTxBytes: 0 }), // pre-reset
      sample(-50 * 60_000, { bandwidthRxBytes: 9000, bandwidthTxBytes: 0 }),
    ];
    const result = computeMetricsWindow(samples, [], 'pi-x', { now: NOW });
    // 9000→9999 = +999, 9999→1000 = NEGATIVE (clamp 0). Total = 999.
    expect(result.bandwidth.rxBytes24h).toBe(999);
  });

  it('counts boot events from the activity log within the 7d window', () => {
    const activity = [
      { type: 'boot',    screen: 'pi-x', timestamp: new Date(NOW - 1 * 86_400_000).toISOString() },
      { type: 'boot',    screen: 'pi-x', timestamp: new Date(NOW - 3 * 86_400_000).toISOString() },
      { type: 'boot',    screen: 'pi-OTHER', timestamp: new Date(NOW - 1 * 86_400_000).toISOString() },
      { type: 'boot',    screen: 'pi-x', timestamp: new Date(NOW - 10 * 86_400_000).toISOString() }, // outside
      { type: 'offline', screen: 'pi-x', timestamp: new Date(NOW).toISOString() }, // wrong type
    ];
    const result = computeMetricsWindow([], activity, 'pi-x', { now: NOW });
    expect(result.restarts.total7d).toBe(2);
    expect(result.restarts.history).toHaveLength(7);
  });

  it('reports lag percentiles', () => {
    const samples = [];
    for (let i = 1; i <= 100; i++) {
      samples.push(sample(-i * 60_000, { lastLagMs: i }));
    }
    const result = computeMetricsWindow(samples, [], 'pi-x', { now: NOW });
    // p50 of 1..100 → 50ish, p95 → 95ish
    expect(result.responseTime.p50Ms).toBeGreaterThanOrEqual(45);
    expect(result.responseTime.p50Ms).toBeLessThanOrEqual(55);
    expect(result.responseTime.p95Ms).toBeGreaterThanOrEqual(90);
    expect(result.responseTime.p95Ms).toBeLessThanOrEqual(100);
  });

  it('returns the latest mem reading on memory.usedMb', () => {
    const samples = [
      sample(-1 * 60_000, { memUsedMb: 412, memTotalMb: 924 }),
      sample(-2 * 60_000, { memUsedMb: 200, memTotalMb: 924 }),
    ];
    const result = computeMetricsWindow(samples, [], 'pi-x', { now: NOW });
    expect(result.memory.usedMb).toBe(412);
    expect(result.memory.totalMb).toBe(924);
  });

  it('honours the window option', () => {
    const result24 = computeMetricsWindow([], [], 'pi-x', { now: NOW, window: { hours: 24 } });
    const result7 = computeMetricsWindow([], [], 'pi-x', { now: NOW, window: { hours: 168 } });
    expect(result24.bandwidth.rxHistory).toHaveLength(24);
    expect(result24.bucketSpan).toBe('hour');
    expect(result7.bandwidth.rxHistory).toHaveLength(7);
    expect(result7.bucketSpan).toBe('day');
  });
});
