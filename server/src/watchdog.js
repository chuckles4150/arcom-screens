// Background watchdog: any screen that hasn't phoned home in 90s
// gets marked offline. Runs every 30s.
//
// Phase 4: also fires the alert webhook (cooldown enforced inside).
// Phase 7: also creates an `open` incident if there isn't one already.

import {
  getScreens, updateScreen, logActivity,
  findOpenIncident, addIncident, getSettings,
} from './storage.js';
import { fireAlert, formatAlertMessage } from './alerter.js';

const STALE_THRESHOLD_MS = 90_000;

export function startWatchdog() {
  setInterval(async () => {
    const now = Date.now();
    for (const screen of getScreens()) {
      if (screen.status !== 'online') continue;
      if (!screen.lastSeen) continue;

      const lastSeenMs = new Date(screen.lastSeen).getTime();
      if (now - lastSeenMs > STALE_THRESHOLD_MS) {
        await updateScreen(screen.id, { status: 'offline' });
        await logActivity({
          type: 'offline',
          screen: screen.name,
          user: 'system',
          detail: 'Stopped responding',
        });
        console.log(`watchdog: ${screen.name} marked offline`);

        // Phase 7: auto-create an incident if we don't already have one open.
        if (!findOpenIncident(screen.id, 'offline')) {
          const incident = {
            id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            screen: screen.name,
            screenId: screen.id,
            type: 'offline',
            status: 'open',
            createdAt: new Date().toISOString(),
            resolvedAt: null,
            notes: [{
              ts: new Date().toISOString(),
              user: 'system',
              text: `Watchdog flipped offline (last seen ${screen.lastSeen}).`,
            }],
          };
          await addIncident(incident);
        }

        // Phase 4: webhook fire-and-forget.
        const settings = getSettings();
        const lastSeenAgo = formatRelative(lastSeenMs, now);
        const message = formatAlertMessage(screen, 'offline', { lastSeen: lastSeenAgo });
        fireAlert({ settings, screen, kind: 'offline', message }).catch(() => {});
      }
    }
  }, 30_000);

  console.log('watchdog: started');
}

function formatRelative(ts, now) {
  const sec = Math.max(0, Math.round((now - ts) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86_400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86_400)}d ago`;
}
