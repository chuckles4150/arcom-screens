// Background watchdog: any screen that hasn't phoned home in 90s
// gets marked offline. Runs every 30s.

import { getScreens, updateScreen, logActivity } from './storage.js';

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
      }
    }
  }, 30_000);

  console.log('watchdog: started');
}
