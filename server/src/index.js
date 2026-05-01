// arcom-screens server
// Express app: REST API for the dashboard + heartbeat endpoint for Pi clients.
// Also serves the fallback page that Pis show when their target URL is down.

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { screensRouter } from './routes/screens.js';
import { activityRouter } from './routes/activity.js';
import { authMiddleware } from './middleware/auth.js';
import { initStorage } from './storage.js';
import { startWatchdog } from './watchdog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 8080;
const DASHBOARD_DIR = path.resolve(__dirname, '../../dashboard/dist');
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const SCREENSHOTS_DIR = path.resolve(__dirname, '../data/screenshots');

await initStorage();
startWatchdog();

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ── Public endpoints (no auth) ────────────────────────────────────
// Pi clients hit these without the dashboard password.

app.use('/api/pi', screensRouter.piClient);

// Static public assets — fallback.html lives here, no auth needed
app.use(express.static(PUBLIC_DIR));

// ── Authenticated endpoints ───────────────────────────────────────

app.use('/api', authMiddleware);
app.use('/api/screens', screensRouter.dashboard);
app.use('/api/activity', activityRouter);

// ── Static screenshots ────────────────────────────────────────────

app.use('/screenshots', express.static(SCREENSHOTS_DIR));

// ── Dashboard SPA ─────────────────────────────────────────────────

app.use(express.static(DASHBOARD_DIR));
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(DASHBOARD_DIR, 'index.html'));
});

// ── Boot ──────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`arcom-screens running on :${PORT}`);
});