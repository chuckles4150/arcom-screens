// arcom-screens server
// Express app: REST API for the dashboard + heartbeat endpoint for Pi clients.

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
const SCREENSHOTS_DIR = path.resolve(__dirname, '../data/screenshots');

await initStorage();
startWatchdog();

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ── Public endpoints (no auth) ────────────────────────────────────
// Pi clients hit these without the dashboard password.

app.use('/api/pi', screensRouter.piClient);

// ── Authenticated endpoints ───────────────────────────────────────
// Dashboard talks to these.

app.use('/api', authMiddleware);
app.use('/api/screens', screensRouter.dashboard);
app.use('/api/activity', activityRouter);

// ── Static assets ─────────────────────────────────────────────────

app.use('/screenshots', express.static(SCREENSHOTS_DIR));

// ── Dashboard SPA ─────────────────────────────────────────────────
// Serves the built React app. Unauthenticated — auth happens client-side
// and on every API call.

app.use(express.static(DASHBOARD_DIR));
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(DASHBOARD_DIR, 'index.html'));
});

// ── Boot ──────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`arcom-screens running on :${PORT}`);
});
