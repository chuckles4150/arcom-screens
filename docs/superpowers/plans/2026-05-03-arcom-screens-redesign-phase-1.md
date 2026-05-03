# Arcom Screens — Phase 1 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to walk this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Arcom Screens dashboard against the design bundle's visual language, wire it to the real server API (replacing hard-coded demo data), add minimal server support (uptime derivation, network summary endpoint, snapshotAt timestamps), all on the `redesign/server` branch.

**Architecture:** React 18 + Vite SPA fronts an Express + JSON-file-store backend. UI splits the existing 1024-line monolith into ~20 focused per-component files under `dashboard/src/components/{pages,screens,activity}/`. Theme tokens move from inline CSS-in-JS to a shared `theme.js` + CSS-variable `index.css`. Server gains a pure-derivation `uptime.js` module (vitest-tested), a `network.js` summary route, and a `snapshotAt` field on screen responses. Polling-based auto-refresh; no global state library.

**Tech Stack:** React 18, Vite 5, lucide-react, Express 4, vitest (new), Node 18+.

**Spec:** `docs/superpowers/specs/2026-05-03-arcom-screens-redesign-design.md`.

**Branch:** `redesign/server` (Pi-side instrumentation deferred to `redesign/kiosks` in Phase 2).

**Hardware target:** The Express server + the built dashboard run on a **Raspberry Pi 5** (4–8 GB RAM, Cortex-A76). The kiosks displaying screens are **Raspberry Pi 3s** (1 GB RAM, Chromium kiosk mode) — Phase 1 doesn't touch them at all; they continue to phone home with heartbeats and screenshots exactly as they do today. Implementation should stay lean: production bundle remains small (Vite default), no heavy server deps added (vitest is dev-only and never installed on the Pi 5 in production), no per-tick scans larger than O(activity log size = ≤500).

---

## Task 1: Server — add vitest

**Files:**
- Modify: `server/package.json`
- Create: `server/vitest.config.js`

- [ ] Install vitest as a devDependency:

  ```bash
  cd server && npm install --save-dev vitest
  ```

- [ ] Add `"test": "vitest run"` and `"test:watch": "vitest"` to `server/package.json` scripts.

- [ ] Create `server/vitest.config.js`:

  ```js
  import { defineConfig } from 'vitest/config';
  export default defineConfig({ test: { environment: 'node', globals: false } });
  ```

- [ ] Verify: `cd server && npm test` runs (no tests yet, but no error).

- [ ] Commit: `chore(server): add vitest test runner`.

## Task 2: Server — `uptime.js` module + tests

**Files:**
- Create: `server/src/uptime.js`
- Create: `server/src/uptime.test.js`

The module exports one pure function:

```js
// computeUptime(activity, screen, opts) → { uptimePct, history }
// activity: array of { type, screen, timestamp } in newest-first order (as stored)
// screen:   { name, status, lastSeen }   (current state)
// opts:     { now: Date, days: number }
// Returns:  { uptimePct: number 0..100, history: number[7] (oldest→newest) }
```

**Algorithm.** For each of the last `days` days (UTC midnight buckets):
1. Walk activity events for this screen within the window plus the most recent prior status-change event (to know the state at window start).
2. Replay events: each `online` opens an interval, each `offline` closes it. Open intervals at window end use `now` if current `status === 'online'`.
3. Sum online-minutes per day; divide by 1440 (or partial-day count for today) × 100 = pct.
4. `uptimePct` is the simple average of the daily percentages.

- [ ] Write tests covering: never-online screen → 0%; always-online → 100%; one-hour outage on day 3 → ~95.8% for day 3; current status `offline` with no recent events → uses `lastSeen` as the implicit `offline` event; events outside window are ignored except the most-recent-prior for state; empty activity list with current status `online` → assumes online for full window.

- [ ] Implement `uptime.js`. Keep it ~80 lines.

- [ ] Run tests: `cd server && npm test`. All pass.

- [ ] Commit: `feat(server): add uptime derivation module with tests`.

## Task 3: Server — `GET /api/screens/:id/uptime` endpoint

**Files:**
- Modify: `server/src/routes/screens.js`

- [ ] Import `computeUptime` from `../uptime.js` and `getActivity` from `../storage.js`.

- [ ] Add to `dashboard` router:

  ```js
  dashboard.get('/:id/uptime', (req, res) => {
    const screen = getScreen(req.params.id);
    if (!screen) return res.status(404).json({ error: 'not found' });
    const days = parseWindow(req.query.window) || 7;
    const result = computeUptime(getActivity(), screen, { now: new Date(), days });
    res.json(result);
  });
  ```

  Where `parseWindow('7d')` → 7, `parseWindow('30d')` → 30, default 7.

- [ ] Smoke test: start server, register a fake screen via `POST /api/screens`, hit `GET /api/screens/<id>/uptime` and verify shape.

- [ ] Commit: `feat(server): add per-screen uptime endpoint`.

## Task 4: Server — `GET /api/network/summary` endpoint

**Files:**
- Create: `server/src/routes/network.js`
- Modify: `server/src/index.js` (mount the router)

- [ ] Create `network.js` that returns:

  ```js
  router.get('/summary', (req, res) => {
    const screens = getScreens();
    const activity = getActivity();
    const now = new Date();
    const days = 7;

    const counts = {
      total: screens.length,
      online: screens.filter(s => s.status === 'online').length,
      offline: screens.filter(s => s.status === 'offline').length,
      rotating: screens.filter(s => (s.urls?.length || 0) > 1).length,
    };

    // Online history: average uptime across all screens per day
    const onlineHistory = averageUptimeHistory(activity, screens, { now, days });

    // Total history: count of screens that existed at end of each day
    // (use min of current total — we don't have removal timestamps yet)
    const totalHistory = Array(days).fill(counts.total);

    // Offline history: count per day where uptimePct < 100
    const offlineHistory = countOfflineHistory(activity, screens, { now, days });

    // Rotating history: snapshot only — we don't track rotation membership over time yet
    const rotatingHistory = Array(days).fill(counts.rotating);

    const uptimePct7d = onlineHistory.length
      ? onlineHistory.reduce((a, b) => a + b, 0) / onlineHistory.length
      : 100;

    res.json({
      counts,
      history: {
        total: totalHistory, online: onlineHistory,
        offline: offlineHistory, rotating: rotatingHistory,
      },
      uptimePct7d,
    });
  });
  ```

  `averageUptimeHistory` and `countOfflineHistory` are small helpers in this file that call into `computeUptime` per screen.

- [ ] Mount in `server/src/index.js`: `app.use('/api/network', networkRouter)` (with `requireAuth` middleware applied).

- [ ] Smoke test: start server, hit `GET /api/network/summary`, verify shape.

- [ ] Commit: `feat(server): add network summary endpoint for hero metrics`.

## Task 5: Server — `snapshotAt` on screen responses

**Files:**
- Modify: `server/src/routes/screens.js`
- Modify: `server/src/storage.js` (helper)

- [ ] Add helper to `storage.js`:

  ```js
  import path from 'path';
  export async function getSnapshotAt(hostname) {
    try {
      const stat = await fs.stat(path.join(SCREENSHOTS_DIR, `${hostname}.png`));
      return stat.mtime.toISOString();
    } catch { return null; }
  }
  ```

- [ ] In `routes/screens.js`, decorate `GET /` and `GET /:id` responses to include `snapshotAt` for each screen:

  ```js
  dashboard.get('/', async (req, res) => {
    const screens = await Promise.all(
      getScreens().map(async s => ({ ...s, snapshotAt: await getSnapshotAt(s.hostname) }))
    );
    res.json({ screens });
  });
  ```

- [ ] Smoke test: server running, POST a screen, drop a fake `<hostname>.png` into `data/screenshots/`, GET the screen — verify `snapshotAt` is set; GET another screen with no snapshot — verify `snapshotAt: null`.

- [ ] Commit: `feat(server): include snapshotAt timestamp in screen responses`.

## Task 6: Dashboard — theme tokens + global CSS + logo

**Files:**
- Create: `dashboard/src/theme.js`
- Create: `dashboard/src/index.css`
- Modify: `dashboard/src/main.jsx` (import index.css)
- Create: `dashboard/public/logo-reversed.svg` (copy from design bundle)

- [ ] Copy `logo-reversed.svg` from `/tmp/design-pkg/arcom-screens/project/arcom/logo-reversed.svg` to `dashboard/public/logo-reversed.svg`.

- [ ] Write `theme.js` exporting a `T` object with all design tokens (full names matching `colors_and_type.css`):

  ```js
  export const T = {
    arcNavy: '#002B49', arcNavy700: '#0A3A5C', arcNavy500: '#1E5079',
    arcNavy300: '#6A8BA4', arcNavy100: '#DCE5EE',
    arcSage: '#7BA06A', arcSage700: '#567B49', arcSage300: '#B6CFA9', arcSage100: '#E1ECD8',
    arcYellow: '#FFB627', arcYellow600: '#E89F0F', arcYellow200: '#FFE3A8', arcYellow50: '#FFF7E4',
    arcBone: '#FAF7F2', arcCream: '#F4EFE6', arcSand: '#E8E0D2', arcStone: '#C7BEAE',
    arcTaupe: '#8A8275', arcChar: '#2B2A27', arcCharSoft: '#4A4842', arcWhite: '#FFFFFF',
    fg1: '#2B2A27', fg2: '#4A4842', fg3: '#8A8275',
    fgBrand: '#002B49', fgAccent: '#567B49', fgHighlight: '#E89F0F',
    bgApp: '#FAF7F2', bgSurface: '#FFFFFF', bgSurfaceAlt: '#F4EFE6', bgInset: '#E8E0D2',
    statusOk: '#4E8F57', statusOkBg: '#E4EDE5',
    statusWarn: '#D7891A', statusWarnBg: '#FFF1D4',
    statusDanger: '#B3432B', statusDangerBg: '#FADFD6',
    line1: '#E4DDCF', line2: '#D3C9B5',
    radiusXs: 4, radiusSm: 8, radiusMd: 12, radiusLg: 18, radiusXl: 24, radiusPill: 999,
    fontDisplay: "'Montserrat', 'Helvetica Neue', Arial, sans-serif",
    fontBody:    "'Open Sans', 'Segoe UI', Roboto, sans-serif",
    fontMono:    "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace",
    shadowXs:   '0 1px 2px rgba(43, 42, 39, 0.06)',
    shadowSm:   '0 2px 6px rgba(43, 42, 39, 0.08)',
    shadowMd:   '0 6px 18px rgba(0, 43, 73, 0.10)',
    shadowLg:   '0 16px 36px rgba(0, 43, 73, 0.14)',
  };
  ```

- [ ] Write `index.css` with Google Fonts import, CSS-variable mirror, global resets, and keyframe animations from the design (`arc-pulse`, `arc-fade`, `arc-slide`, `arc-pop`).

- [ ] In `main.jsx` add `import './index.css';` before the App import.

- [ ] Run `cd dashboard && npm run dev` to confirm fonts load and no parse errors.

- [ ] Commit: `feat(dashboard): add theme tokens, global CSS, and logo asset`.

## Task 7: Dashboard — extend `api.js`

**Files:**
- Modify: `dashboard/src/api.js`

- [ ] Add helpers to the exported `api` object:

  ```js
  networkSummary: () => request('GET', '/api/network/summary'),
  screenUptime: (id, window = '7d') =>
    request('GET', `/api/screens/${id}/uptime?window=${window}`),
  ```

- [ ] Confirm `listActivity({ screen, type, limit })` already builds the right query string (it does).

- [ ] Commit: `feat(dashboard): add api helpers for uptime + network summary`.

## Task 8: Dashboard — `useFetch` hook

**Files:**
- Create: `dashboard/src/hooks/useFetch.js`

- [ ] Implement:

  ```js
  import { useState, useEffect, useRef, useCallback } from 'react';

  export function useFetch(loader, deps = []) {
    const [state, setState] = useState({ data: null, error: null, loading: true });
    const loaderRef = useRef(loader);
    loaderRef.current = loader;

    const run = useCallback(async () => {
      setState(s => ({ ...s, loading: true, error: null }));
      try {
        const data = await loaderRef.current();
        setState({ data, error: null, loading: false });
      } catch (err) {
        setState({ data: null, error: err, loading: false });
      }
    }, []);

    useEffect(() => { run(); }, deps);

    return { ...state, refetch: run };
  }

  export function usePolling(loader, intervalMs, deps = []) {
    const fetchState = useFetch(loader, deps);
    useEffect(() => {
      let timer;
      const tick = () => {
        if (document.visibilityState === 'visible') fetchState.refetch();
      };
      timer = setInterval(tick, intervalMs);
      const onVis = () => { if (document.visibilityState === 'visible') fetchState.refetch(); };
      document.addEventListener('visibilitychange', onVis);
      return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVis); };
    }, [intervalMs]);
    return fetchState;
  }
  ```

- [ ] Commit: `feat(dashboard): add useFetch + usePolling hooks`.

## Task 9: Dashboard — `Sparkline.jsx`

**Files:**
- Create: `dashboard/src/components/screens/Sparkline.jsx`

- [ ] Port the `Sparkline` from the design bundle's `components.jsx`. Default `color = T.arcSage`, `height = 28`.

- [ ] Handle empty/single-value cases gracefully (render nothing or a flat line).

- [ ] Commit: `feat(dashboard): add Sparkline component`.

## Task 10: Dashboard — `StatusChip.jsx`

**Files:**
- Create: `dashboard/src/components/screens/StatusChip.jsx`

- [ ] Pill chip taking `status: 'online' | 'offline' | 'rotating'`, optional `size: 'sm' | 'md'`. Maps to chip-online (sage bg, navy text) / chip-offline (danger bg/fg) / chip-rotating (yellow tint, dark yellow text).

- [ ] Includes a tiny status dot icon.

- [ ] Commit: `feat(dashboard): add StatusChip component`.

## Task 11: Dashboard — `MetricCard.jsx`

**Files:**
- Create: `dashboard/src/components/screens/MetricCard.jsx`

- [ ] Reusable card taking: `label`, `value`, `sub`, `history` (number[]), `accent` (sage/navy/yellow/danger), `kind` ('sparkline' | 'bar'). Renders the metric card pattern from `Screens.html`'s `.metric` class.

- [ ] Commit: `feat(dashboard): add MetricCard component`.

## Task 12: Dashboard — `Sidebar.jsx`

**Files:**
- Create: `dashboard/src/components/Sidebar.jsx`

- [ ] 232px wide, navy bg, sticky. Logo top, nav (Screens/Activity/Settings), server-status card + user footer at bottom.

- [ ] Active item: yellow text + 3px yellow left border.

- [ ] Logout in footer calls `clearStoredPassword()` from `api.js` and `window.location.reload()`.

- [ ] Commit: `feat(dashboard): add Sidebar component`.

## Task 13: Dashboard — `Topbar.jsx`

**Files:**
- Create: `dashboard/src/components/Topbar.jsx`

- [ ] 56px tall, white bg, hairline bottom border. Search input on left (controlled, lifted to parent via `onSearch` prop), live network status pill in center-right (`{online, rotating, offline}` props), Add screen primary button on right (`onAdd` prop).

- [ ] Commit: `feat(dashboard): add Topbar component`.

## Task 14: Dashboard — `ScreenTile.jsx`

**Files:**
- Create: `dashboard/src/components/screens/ScreenTile.jsx`

- [ ] 16:9 preview area on top: `<img src="/screenshots/{hostname}.png" />` if `snapshotAt`, else colored placeholder block. Color from `hashHostname(hostname)` → HSL.

- [ ] Status chip overlay top-left, rotating badge top-right (only when `urls.length > 1`).

- [ ] Hover actions bottom-right (open external, force refresh, edit) with opacity transition.

- [ ] Body: name (Montserrat 14/600), `hostname · IP` (mono), current URL pill, foot row (`Refresh: Nm` or `Rotating · N URLs`, separator dot, `Seen Xs ago`), `Snap N min ago` mono caption beneath.

- [ ] Click anywhere on tile (not on action buttons) → calls `onSelect(screen)`.

- [ ] Helper `formatRelative(timestamp)` for "Xs ago / Xm ago / Xh ago / Xd ago".

- [ ] Commit: `feat(dashboard): add ScreenTile with snapshot preview`.

## Task 15: Dashboard — `ScreenTable.jsx`

**Files:**
- Create: `dashboard/src/components/screens/ScreenTable.jsx`

- [ ] Refactored from existing `ScreenManager.jsx`'s `ScreenTable` — same columns (SCREEN / HOSTNAME / URL / REFRESH / STATUS / LAST SEEN), per-row actions (preview / refresh / edit). New theme tokens, no thumbnail.

- [ ] Click row → `onSelect(screen)` (same as tile).

- [ ] Commit: `feat(dashboard): add ScreenTable component`.

## Task 16: Dashboard — `AddScreenModal.jsx`

**Files:**
- Create: `dashboard/src/components/screens/AddScreenModal.jsx`

- [ ] Refactored from existing `AddModal` in `ScreenManager.jsx`. Same form fields (name, hostname, ip, url, refresh, location). Form-validates client-side; on submit calls `api.addScreen(...)` then `onAdded(newScreen)`.

- [ ] Restyled to new tokens.

- [ ] Commit: `feat(dashboard): add AddScreenModal component`.

## Task 17: Dashboard — `EditScreenModal.jsx`

**Files:**
- Create: `dashboard/src/components/screens/EditScreenModal.jsx`

- [ ] Refactored from existing `EditModal` in `ScreenManager.jsx`. Preserves multi-URL rotation editing. **Removes** the in-modal delete button — that lives in `DrillPanel` footer in the new design.

- [ ] On submit, calls `api.updateScreen(id, patch)` then `onSaved(updated)`.

- [ ] Commit: `feat(dashboard): add EditScreenModal component`.

## Task 18: Dashboard — `DrillPanel.jsx`

**Files:**
- Create: `dashboard/src/components/screens/DrillPanel.jsx`

- [ ] Right-side drawer (420px desktop, full-screen mobile). Closes on X / Escape / scrim click.

- [ ] On open: fetches `api.screenUptime(id)` and `api.listActivity({ screen: name, limit: 10 })` in parallel via `useFetch`.

- [ ] Sections (top to bottom):
  - Header (eyebrow `SCREEN DETAIL`, name, status chip, X)
  - Big preview (16:9 snapshot ~360px tall, `Snap N min ago · <currentUrl>` caption)
  - Action row (4 pills: Force refresh / Edit settings / Open URL / Console (disabled))
  - Stats grid (Phase 1: just the Uptime · 7d card with sparkline)
  - Rotation schedule (only if `urls.length > 1`, NOW chip on `currentUrl`)
  - Recent activity (last 10, "View all" link)
  - Detail rows (Hostname, IP, Mode, Reload interval, Last seen, Created, Location)
  - Footer (duplicate Force refresh + Edit settings; `Remove screen` ghost link with confirm step)

- [ ] `Force refresh` calls `api.refreshScreen(id)` and shows a toast (passed in via `onToast` prop).

- [ ] `Remove screen` (after confirm) calls `api.deleteScreen(id)`, calls `onDeleted(id)`, closes panel.

- [ ] Commit: `feat(dashboard): add DrillPanel with rich per-screen detail`.

## Task 19: Dashboard — `ScreensPage.jsx`

**Files:**
- Create: `dashboard/src/components/pages/ScreensPage.jsx`

- [ ] On mount, two parallel calls (`usePolling` 15s):
  - `api.listScreens()` → screens array
  - `api.networkSummary()` → counts + history

- [ ] Pauses polling when tab hidden (handled by `usePolling`).

- [ ] State: `view: 'grid' | 'table'`, `filter: 'all' | 'online' | 'offline' | 'rotating'`, `search: string`, `selected: screen | null`, `editing: screen | null`, `showAdd: boolean`.

- [ ] Renders, top to bottom:
  - Page-head (eyebrow `Screens · N devices · Live`, h1 `Display network`, subtitle, yellow accent rule). Right side: network health % from `summary.uptimePct7d` (color-flipped when offline > 0).
  - Conditional `IncidentBar` (when `counts.offline > 0`): navy gradient strip with names, last-contact, DIAGNOSE (sets `selected` to first offline) + ALERT TEAM (toast: "Team alerts arrive in Phase 2").
  - 4 `MetricCard`s populated from `summary.counts` and `summary.history`.
  - Controls row: filter chips (counts from summary), `N of M shown` count, grid/table toggle.
  - Grid (`ScreenTile`s, `repeat(auto-fit, minmax(280px, 1fr))`) or table (`ScreenTable`).
  - Empty states: "Register your first screen" CTA when `screens.length === 0`; "No screens match this filter" when filter/search empties results.

- [ ] Modals: `<AddScreenModal>`, `<EditScreenModal>`, `<DrillPanel>` rendered conditionally.

- [ ] Optimistic updates: after add/edit/delete, update local screen list immediately + refetch.

- [ ] Search filters tile/table set; metric cards always reflect network totals.

- [ ] Commit: `feat(dashboard): add ScreensPage`.

## Task 20: Dashboard — Activity components + `ActivityPage.jsx`

**Files:**
- Create: `dashboard/src/components/activity/ActivityRow.jsx`
- Create: `dashboard/src/components/activity/ActivityFilters.jsx`
- Create: `dashboard/src/components/pages/ActivityPage.jsx`

- [ ] `ActivityRow` — icon (per-kind lookup: refresh/edit/online/offline/add/remove + fallback) with color, screen name (Montserrat 600, hover-link), detail (body), user + relative time on right.

- [ ] `ActivityFilters` — 5 chips: All / Incidents / Refreshes / Content / System. Active = navy pill with white text. Counts shown beside each label. Maps to client-side filtering by event-type group.

- [ ] `ActivityPage`:
  - `usePolling(api.listActivity, 30000)`, paginated `limit` state starting at 100.
  - Page-head + 4 summary cards (Incidents/Refreshes/Content/System · 24h with `↑/↓ vs yesterday`).
  - `ActivityFilters` chip row.
  - Day-grouped list (`TODAY`, `YESTERDAY`, `MON 28 APR`). Each group: subheader with horizontal rule and per-day count, then `ActivityRow`s.
  - Empty state when filter empties results.
  - "Load more" ghost button below if `activity.length === limit` (extends limit to `+100`).

- [ ] Helper `groupByDay(events, now)` — buckets by `TODAY` / `YESTERDAY` / formatted weekday-day-month.

- [ ] Helper `kindOf(event)` — collapses event type into chip group.

- [ ] Commit: `feat(dashboard): add ActivityPage with day grouping and filters`.

## Task 21: Dashboard — `SettingsPage.jsx`

**Files:**
- Create: `dashboard/src/components/pages/SettingsPage.jsx`

- [ ] Page-head + a single info card: "Settings panel — coming in a future phase." Match existing minimal scope. Use new tokens.

- [ ] Commit: `feat(dashboard): add SettingsPage stub with new chrome`.

## Task 22: Dashboard — rewrite `ScreenManager.jsx` as shell

**Files:**
- Modify: `dashboard/src/components/ScreenManager.jsx` (replace entire contents)

- [ ] Become a thin layout shell: `Sidebar` + `<main>` containing `Topbar` + the active page (`ScreensPage` / `ActivityPage` / `SettingsPage`).

- [ ] Owns nav state (`activeNav`), search input value (passed to ScreensPage), and a global toast ('Screen added', 'Refresh sent', etc.).

- [ ] Removes ALL hard-coded screen and activity arrays.

- [ ] Removes obsolete inline modals/cards (now in their own files).

- [ ] Should be ~80 lines.

- [ ] Commit: `refactor(dashboard): rewrite ScreenManager as thin shell`.

## Task 23: Dashboard — restyle `Login.jsx`

**Files:**
- Modify: `dashboard/src/components/Login.jsx`

- [ ] Replace hand-rolled `T` import with new `theme.js` `T`. Update token names where they changed (e.g. old `T.bone` → new `T.arcBone`, old `T.navyMid` → `T.arcNavy`, etc.).

- [ ] Behaviour unchanged.

- [ ] Commit: `style(dashboard): restyle Login with new theme tokens`.

## Task 24: Dashboard — delete obsolete `styles.js`

**Files:**
- Delete: `dashboard/src/components/styles.js`

- [ ] Confirm no remaining imports of `./styles.js` (grep).

- [ ] Delete the file.

- [ ] Commit: `chore(dashboard): remove obsolete styles.js token map`.

## Task 25: Verification

- [ ] `cd server && npm test` → all uptime tests pass.

- [ ] `cd dashboard && npm run build` → succeeds with no errors.

- [ ] Start server (`cd server && npm start`) and dashboard (`cd dashboard && npm run dev`) in separate background processes.

- [ ] Manually exercise (Chuck does this in browser):
  - Empty install: open `localhost:5173`, log in with dashboard password, verify "Register your first screen" CTA.
  - Register a screen via the modal; verify it appears in tile + activity log.
  - Manual heartbeat: `curl -X POST localhost:8080/api/pi/heartbeat -H 'Content-Type: application/json' -d '{"hostname":"<hostname>","currentUrl":"https://example.com"}'` → screen flips online, `Seen Xs ago` updates within 15s.
  - Drop a fake PNG into `data/screenshots/<hostname>.png` → tile preview updates, `Snap N min ago` caption shows.
  - Click a tile → DrillPanel opens with uptime card + recent activity.
  - Force-refresh → toast appears, activity log gains entry.
  - Edit a screen → save → tile updates.
  - Remove a screen via DrillPanel footer → confirm step → screen disappears.
  - Toggle grid/table view; filter by status; search by name.
  - Open Activity page; filter chips work; Load more extends results.
  - Open Settings page; renders cleanly.

- [ ] Confirm `redesign/kiosks` branch is untouched: `git diff redesign/kiosks redesign/server -- pi-client/` shows only differences are new files in `dashboard/`, `server/`, `docs/` — nothing in `pi-client/`.

- [ ] Final commit if any verification fixes needed.

---

## Self-review checklist

After plan completion, before declaring done:

- Spec coverage: every Phase-1 spec section mapped to a task above? ✓ (Server: 1–5; Theme/CSS: 6; API: 7; Hooks: 8; Leaf: 9–11; Chrome: 12–13; Tiles/modals/drill: 14–18; Pages: 19–21; Shell/login/cleanup: 22–24; Verification: 25.)
- Placeholders: none (no TBD/TODO).
- Type consistency: `theme.js` token names (e.g. `arcNavy`) used consistently across all UI tasks.
- Phase 2 boundary: pi-client untouched.
