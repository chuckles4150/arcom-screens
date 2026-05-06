import { describe, it, expect, beforeEach } from 'vitest';
import { fireAlert, _resetCooldownsForTest, formatAlertMessage } from './alerter.js';

const SETTINGS = {
  alertWebhookUrl: 'https://hooks.example/webhook/T1',
  alertOnOffline: true,
  alertOnReboot: false,
  alertCooldownMinutes: 5,
};

const SCREEN = { id: 'screen-1', name: 'Workshop', ip: '192.168.1.10' };

function mockFetch(impl) {
  return async (url, opts) => impl({ url, opts });
}

describe('fireAlert', () => {
  beforeEach(() => _resetCooldownsForTest());

  it('does nothing when no webhook is configured', async () => {
    const result = await fireAlert({
      settings: { alertWebhookUrl: '' },
      screen: SCREEN, kind: 'offline', message: 'x',
      fetchImpl: mockFetch(() => ({ ok: true })),
    });
    expect(result.fired).toBe(false);
    expect(result.reason).toBe('no-webhook-configured');
  });

  it('skips offline alerts when the toggle is off', async () => {
    const result = await fireAlert({
      settings: { ...SETTINGS, alertOnOffline: false },
      screen: SCREEN, kind: 'offline', message: 'x',
      fetchImpl: mockFetch(() => ({ ok: true })),
    });
    expect(result.fired).toBe(false);
    expect(result.reason).toBe('offline-trigger-disabled');
  });

  it('fires once, then blocks the second within the cooldown', async () => {
    let posts = 0;
    const fetchImpl = mockFetch(() => { posts++; return { ok: true }; });

    const a = await fireAlert({
      settings: SETTINGS, screen: SCREEN, kind: 'offline', message: 'first',
      fetchImpl, now: 1_000_000,
    });
    const b = await fireAlert({
      settings: SETTINGS, screen: SCREEN, kind: 'offline', message: 'second',
      fetchImpl, now: 1_000_000 + 60_000, // 1 minute later
    });
    expect(a.fired).toBe(true);
    expect(b.fired).toBe(false);
    expect(b.reason).toBe('cooldown');
    expect(posts).toBe(1);
  });

  it('fires again once cooldown has expired', async () => {
    let posts = 0;
    const fetchImpl = mockFetch(() => { posts++; return { ok: true }; });

    const t0 = 2_000_000;
    await fireAlert({ settings: SETTINGS, screen: SCREEN, kind: 'offline', message: '1', fetchImpl, now: t0 });
    const after = await fireAlert({
      settings: SETTINGS, screen: SCREEN, kind: 'offline', message: '2',
      fetchImpl, now: t0 + 6 * 60_000, // 6 min later, past 5-min cooldown
    });
    expect(after.fired).toBe(true);
    expect(posts).toBe(2);
  });

  it('cooldowns are scoped to (screenId, kind)', async () => {
    let posts = 0;
    const fetchImpl = mockFetch(() => { posts++; return { ok: true }; });
    const t0 = 3_000_000;

    await fireAlert({ settings: SETTINGS, screen: SCREEN, kind: 'offline', message: 'x', fetchImpl, now: t0 });
    // Same screen, different kind (and toggle off — set both for this test)
    const b = await fireAlert({
      settings: { ...SETTINGS, alertOnReboot: true },
      screen: SCREEN, kind: 'boot', message: 'y', fetchImpl, now: t0 + 1000,
    });
    // Different screen, same kind
    const c = await fireAlert({
      settings: SETTINGS,
      screen: { ...SCREEN, id: 'screen-2', name: 'Other' },
      kind: 'offline', message: 'z', fetchImpl, now: t0 + 2000,
    });

    expect(b.fired).toBe(true);
    expect(c.fired).toBe(true);
    expect(posts).toBe(3);
  });

  it('force bypasses cooldown and toggles', async () => {
    let posts = 0;
    const fetchImpl = mockFetch(() => { posts++; return { ok: true }; });
    const t0 = 4_000_000;

    await fireAlert({ settings: SETTINGS, screen: SCREEN, kind: 'offline', message: '1', fetchImpl, now: t0 });
    const second = await fireAlert({
      settings: { ...SETTINGS, alertOnOffline: false },
      screen: SCREEN, kind: 'offline', message: '2', fetchImpl, now: t0 + 1000,
      force: true,
    });
    expect(second.fired).toBe(true);
    expect(posts).toBe(2);
  });

  it('returns http-XXX when webhook responds non-2xx', async () => {
    const fetchImpl = mockFetch(() => ({ ok: false, status: 503 }));
    const result = await fireAlert({
      settings: SETTINGS, screen: SCREEN, kind: 'offline', message: 'x',
      fetchImpl, now: 5_000_000,
    });
    expect(result.fired).toBe(false);
    expect(result.reason).toBe('http-503');
  });
});

describe('formatAlertMessage', () => {
  it('produces a human-readable string for each kind', () => {
    const screen = { name: 'Workshop', ip: '10.1.1.7' };
    expect(formatAlertMessage(screen, 'offline', { lastSeen: '5m ago' })).toMatch(/offline/);
    expect(formatAlertMessage(screen, 'boot', { detail: 'after 12h' })).toMatch(/rebooted/);
    expect(formatAlertMessage(screen, 'manual')).toMatch(/Heads up/);
    expect(formatAlertMessage(screen, 'test')).toMatch(/test/);
  });
});
