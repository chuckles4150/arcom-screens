import { describe, it, expect } from 'vitest';
import { computeUptime, parseWindow } from './uptime.js';

const DAY = 86_400_000;

// Pin "now" to a specific instant so day-bucket math is deterministic.
// 2026-05-08T18:00 local — partial last bucket (~18 hours of "today").
function fixedNow() {
  const d = new Date(2026, 4, 8, 18, 0, 0, 0); // May is month 4
  return d;
}

function midnightNDaysAgo(n, now) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime() - n * DAY;
}

describe('parseWindow', () => {
  it('parses Nd format', () => {
    expect(parseWindow('7d')).toBe(7);
    expect(parseWindow('30d')).toBe(30);
    expect(parseWindow('1d')).toBe(1);
  });
  it('returns null on bad input', () => {
    expect(parseWindow('')).toBe(null);
    expect(parseWindow('7')).toBe(null);
    expect(parseWindow('7days')).toBe(null);
    expect(parseWindow(undefined)).toBe(null);
  });
});

describe('computeUptime', () => {
  it('returns 0 for never-online screen with no events', () => {
    const screen = { name: 'pi-x', status: 'offline', lastSeen: null };
    const result = computeUptime([], screen, { now: fixedNow(), days: 7 });
    expect(result.uptimePct).toBe(0);
    expect(result.history).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('returns 100 for currently-online screen with no events', () => {
    const screen = { name: 'pi-x', status: 'online', lastSeen: fixedNow().toISOString() };
    const result = computeUptime([], screen, { now: fixedNow(), days: 7 });
    expect(result.uptimePct).toBe(100);
    expect(result.history).toEqual([100, 100, 100, 100, 100, 100, 100]);
  });

  it('handles a one-hour outage three days ago: that day ~95.8%, others 100%', () => {
    const now = fixedNow();
    const dayMinus3Midnight = midnightNDaysAgo(3, now);
    const offlineAt = dayMinus3Midnight + 10 * 3600_000;        // 10:00
    const onlineAgainAt = offlineAt + 3600_000;                  // 11:00
    const activity = [
      { type: 'offline', screen: 'pi-x', timestamp: new Date(offlineAt).toISOString() },
      { type: 'online',  screen: 'pi-x', timestamp: new Date(onlineAgainAt).toISOString() },
    ];
    const screen = { name: 'pi-x', status: 'online', lastSeen: now.toISOString() };
    const result = computeUptime(activity, screen, { now, days: 7 });

    // history[0..6]: oldest first. Day index 4 (= day-3-from-end in 7-day window) is the outage day.
    // 7-day window: indexes 0..6 = days_ago(6,5,4,3,2,1,0). Outage day = days_ago=3 = index 3.
    // Wait: with days=7, today is index 6, yesterday is index 5, days_ago(N) is index 6-N.
    // So days_ago=3 is index 3.
    // 1 hour offline / 24 hours = 4.16% offline → 95.83% online → rounded to 95.8.
    expect(result.history[3]).toBeCloseTo(95.8, 1);
    expect(result.history[0]).toBe(100);
    expect(result.history[1]).toBe(100);
    expect(result.history[2]).toBe(100);
    expect(result.history[4]).toBe(100);
    expect(result.history[5]).toBe(100);
    expect(result.history[6]).toBe(100);
  });

  it('handles current state: offline for the last day with no events in window', () => {
    const now = fixedNow();
    // The most-recent event was an OFFLINE 4 days ago. Screen is currently offline.
    // Window: 7 days. Days 0,1,2 (oldest 3 days back from start of window)
    // are BEFORE the offline event (state was online). Wait — let me reason again.
    // windowStart = midnight 6 days ago. Offline event at 4 days ago = inside window.
    // State at windowStart: from prior events — none — so falls back to current
    // status='offline' or events[0].state inversion. events[0] is offline → infer prior was online.
    const offlineAt = midnightNDaysAgo(4, now) + 12 * 3600_000;
    const activity = [
      { type: 'offline', screen: 'pi-x', timestamp: new Date(offlineAt).toISOString() },
    ];
    const screen = { name: 'pi-x', status: 'offline', lastSeen: new Date(offlineAt).toISOString() };
    const result = computeUptime(activity, screen, { now, days: 7 });

    // Days at indexes 0,1 (6 and 5 days ago): fully online → 100
    // Index 2 (4 days ago = day of offline at 12:00): online for 12 hours → 50
    // Index 3 (3 days ago) onward: offline → 0
    expect(result.history[0]).toBe(100);
    expect(result.history[1]).toBe(100);
    expect(result.history[2]).toBe(50);
    expect(result.history[3]).toBe(0);
    expect(result.history[4]).toBe(0);
    expect(result.history[5]).toBe(0);
    expect(result.history[6]).toBe(0);
  });

  it('ignores events outside the window except the most-recent prior', () => {
    const now = fixedNow();
    const veryOldOnline = midnightNDaysAgo(30, now); // outside 7d window, sets prior state
    const recentOffline = midnightNDaysAgo(2, now) + 6 * 3600_000;  // 2 days ago at 06:00
    const activity = [
      { type: 'online',  screen: 'pi-x', timestamp: new Date(veryOldOnline).toISOString() },
      { type: 'offline', screen: 'pi-x', timestamp: new Date(recentOffline).toISOString() },
    ];
    const screen = { name: 'pi-x', status: 'offline', lastSeen: new Date(recentOffline).toISOString() };
    const result = computeUptime(activity, screen, { now, days: 7 });

    // State at windowStart: prior event was 'online' 30 days ago → state=online
    // At days_ago=2 = index 4 at 06:00, goes offline → 6/24 = 25% online for that day
    // Days 0..3: 100% online; Day 4: 25%; Days 5,6: 0%
    expect(result.history[0]).toBe(100);
    expect(result.history[1]).toBe(100);
    expect(result.history[2]).toBe(100);
    expect(result.history[3]).toBe(100);
    expect(result.history[4]).toBe(25);
    expect(result.history[5]).toBe(0);
    expect(result.history[6]).toBe(0);
  });

  it('only considers events for the requested screen', () => {
    const now = fixedNow();
    const offlineAt = midnightNDaysAgo(2, now) + 12 * 3600_000;
    const activity = [
      { type: 'offline', screen: 'pi-OTHER', timestamp: new Date(offlineAt).toISOString() },
    ];
    const screen = { name: 'pi-x', status: 'online', lastSeen: now.toISOString() };
    const result = computeUptime(activity, screen, { now, days: 7 });
    expect(result.uptimePct).toBe(100);
  });

  it('partial last day uses (now - midnight) as denominator', () => {
    // fixedNow() is 18:00 → today's bucket is only 18 hours wide.
    // If the screen went offline 1 hour ago, that's 1/18 = 5.56% offline = 94.4% online.
    const now = fixedNow();
    const offlineAt = now.getTime() - 3600_000; // 1 hour before now
    const activity = [
      { type: 'offline', screen: 'pi-x', timestamp: new Date(offlineAt).toISOString() },
    ];
    const screen = { name: 'pi-x', status: 'offline', lastSeen: new Date(offlineAt).toISOString() };
    const result = computeUptime(activity, screen, { now, days: 7 });
    // Today (index 6) was online 17/18 hours
    expect(result.history[6]).toBeCloseTo(94.4, 1);
  });

  it('honours custom days option', () => {
    const screen = { name: 'pi-x', status: 'online', lastSeen: fixedNow().toISOString() };
    const result = computeUptime([], screen, { now: fixedNow(), days: 30 });
    expect(result.history).toHaveLength(30);
    expect(result.uptimePct).toBe(100);
  });
});
