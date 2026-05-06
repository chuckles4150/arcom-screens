// Outbound webhook alerter. Slack-compatible payload by default; works with
// Discord/Mattermost/ntfy/etc. Per-(screenId, kind) cooldown so a flapping
// screen doesn't spam. Cooldown lives in memory only — a server restart
// firing one extra alert is acceptable.

const cooldownMap = new Map(); // key → expiresAtMs

function key(screenId, kind) { return `${screenId || 'global'}::${kind}`; }

// Pure-ish: testable. Returns { fired: bool, reason }. Side effects (the
// network POST) only happen if `force` is true OR cooldown allows.
export async function fireAlert({
  settings, screen, kind, message,
  force = false,
  now = Date.now(),
  fetchImpl = globalThis.fetch,
}) {
  const url = settings?.alertWebhookUrl?.trim();
  if (!url) return { fired: false, reason: 'no-webhook-configured' };

  if (kind === 'offline' && !settings.alertOnOffline && !force) {
    return { fired: false, reason: 'offline-trigger-disabled' };
  }
  if (kind === 'boot' && !settings.alertOnReboot && !force) {
    return { fired: false, reason: 'reboot-trigger-disabled' };
  }

  const k = key(screen?.id, kind);
  if (!force) {
    const expiresAt = cooldownMap.get(k);
    if (expiresAt && expiresAt > now) {
      return { fired: false, reason: 'cooldown' };
    }
  }

  const body = JSON.stringify({ text: message });

  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { fired: false, reason: `http-${res.status}` };
    }
  } catch (err) {
    return { fired: false, reason: `error-${err.name || 'unknown'}` };
  }

  if (!force) {
    const cooldownMs = (settings.alertCooldownMinutes ?? 5) * 60_000;
    cooldownMap.set(k, now + cooldownMs);
  }

  return { fired: true, reason: 'ok' };
}

export function _resetCooldownsForTest() {
  cooldownMap.clear();
}

// Convenience message formatter — used by both auto and manual triggers
// so the user sees consistent text across both paths.
export function formatAlertMessage(screen, kind, opts = {}) {
  const name = screen?.name || screen?.hostname || 'unknown';
  const ip = screen?.ip ? ` (${screen.ip})` : '';
  switch (kind) {
    case 'offline':
      return `🚨 Pi *${name}* offline${ip}. Last seen ${opts.lastSeen || 'unknown'}.`;
    case 'boot':
      return `🔄 Pi *${name}*${ip} rebooted. ${opts.detail || ''}`.trim();
    case 'manual':
      return `📣 Heads up — *${name}*${ip} flagged from the dashboard.${opts.detail ? ' ' + opts.detail : ''}`;
    case 'test':
      return `✅ Arcom Screens — alert webhook test from ${opts.from || 'dashboard'}.`;
    default:
      return `Arcom Screens: ${kind} on *${name}*.`;
  }
}
