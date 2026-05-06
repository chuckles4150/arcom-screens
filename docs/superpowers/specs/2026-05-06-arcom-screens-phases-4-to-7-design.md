# Arcom Screens — Phases 4–7 (Alerts, Playlists, Schedules, Incidents)

**Date:** 2026-05-06
**Branch:** `redesign/kiosks` (continuing on top of Phase 3)
**Author:** Chuck (with Claude)

## Context

User asked to bundle Phases 4–7 into a single delivery rather than four separate brainstorm cycles. This spec is intentionally compact — it captures the design decisions made up-front so that the four subsystems land coherently in one commit.

Each subsystem is built to **MVP** scope: minimum viable feature set, no nice-to-haves. Future polish lands on follow-up tickets.

## Phase 4 — Alerts

**Goal:** Notify a chosen webhook when something needs attention.

**Storage:** new `data/settings.json` — single `{ alertWebhookUrl, alertOnOffline, alertOnReboot, alertCooldownMinutes }` object. In-memory cache, persisted on every change.

**Triggers:**
- Auto: watchdog flipping a screen `offline → online == false` fires a webhook (cooldown per screen).
- Auto: reboot detection (Phase 2 `boot` event) — off by default.
- Manual: `ALERT TEAM` button in the dashboard's incident bar fires a webhook for whichever offline screen is shown.
- Settings "Send test" button fires a one-off webhook with a known payload.

**Webhook payload:** Slack-compatible `{ text: "🚨 Pi <name> offline. Last seen X ago at <ip>." }` — works out-of-the-box with Slack/Discord/Mattermost/ntfy. Fire-and-forget POST with a 5 s timeout.

**Cooldown:** Per (screenId, eventKind) tuple, 5-minute default. Stored in memory only — no need to persist across restarts (a fresh restart firing one extra alert is fine).

**New module:** `server/src/alerter.js` (pure-ish: takes a `fetch` impl + settings + cooldown map; testable).

## Phase 5 — Playlists

**Goal:** Reusable named URL collections.

**Domain object:**
```json
{ "id": "playlist-…", "name": "Shop Floor — Production", "urls": [{ "url": "...", "duration": 30 }, ...], "createdAt": "..." }
```

**Storage:** `data/playlists.json`. Standard CRUD via `/api/playlists`.

**Screen integration:** A screen object can carry `playlistId` instead of (or alongside) inline `urls`. The heartbeat handler resolves at runtime:

1. If `screen.playlistId` is set and the playlist exists, use the playlist's URLs.
2. Otherwise, use `screen.urls` as before (Phase 1 behaviour preserved).

The Pi never sees playlist IDs — it just gets a `urls` array as today.

**EditScreenModal:** Adds a segmented control above the URL editor: `Inline URLs (default)` / `Pick a playlist`. When set to a playlist, the inline URL editor is replaced with a playlist dropdown + "Edit playlist" link.

**Dashboard nav:** PlaylistsPage in the sidebar. List view + simple inline detail editor (name + URL rotation editor reused from EditScreenModal). "Used by N screens" badge per playlist; deleting a playlist warns about the screens that reference it.

## Phase 6 — Schedules

**Goal:** Time-based playlist swaps per screen.

**Domain object:**
```json
{ "id": "sched-…", "screenId": "screen-…", "playlistId": "playlist-…",
  "days": [1,2,3,4,5], "startMin": 360, "endMin": 1080,
  "createdAt": "..." }
```
- `days`: numbers 0..6 (Sun..Sat).
- `startMin` / `endMin`: minutes from local midnight on those days. Same-day blocks only — for "overnight" blocks the user creates two entries (e.g. 22:00–24:00 today + 00:00–06:00 tomorrow).

**Storage:** `data/schedules.json`. CRUD via `/api/schedules`.

**Resolution (server/src/scheduler.js):** Pure function `pickActive(schedules, screenId, now)` returns the schedule whose day+time window contains `now`, or `null`.

**Heartbeat resolution priority:**
1. Active schedule for this screen → use its playlist (resolved as in Phase 5).
2. Else, screen's default `playlistId` (Phase 5).
3. Else, screen's inline `urls`.

**Conflict handling:** If two schedules overlap, the most recently created wins (deterministic, simple). The dashboard shows a "Conflicts with X" warning at create-time but doesn't block save.

**Dashboard:** SchedulesPage with a horizontal week grid per screen. Drag to create blocks (Phase 6.5 polish — for MVP, click → form to add a block). Toggle to enable/disable schedules per screen via `screen.scheduleEnabled` flag (default `true`).

## Phase 7 — Incidents

**Goal:** Tracked records for screen problems with status lifecycle.

**Domain object:**
```json
{ "id": "inc-…", "screen": "Screen Name", "screenId": "screen-…",
  "type": "offline" | "boot-loop" | "manual",
  "status": "open" | "monitoring" | "resolved",
  "createdAt": "...", "resolvedAt": null,
  "notes": [{ "ts": "...", "user": "...", "text": "..." }] }
```

**Storage:** `data/incidents.json`. CRUD via `/api/incidents`. Capped at 200 newest entries.

**Auto-create:** Watchdog flipping a screen offline now also creates an `open` incident if there's no open incident for that screen already. Heartbeat handler bringing a screen back online auto-resolves the open incident (sets `resolvedAt`, status `resolved`).

**Manual interaction:**
- Dashboard's IncidentsPage — list (open / monitoring / resolved tabs) + side detail with notes timeline + `Mark monitoring` / `Resolve` / `Add note` actions.
- A `manual` type can be created from the DrillPanel's "More" menu (deferred — keep dashboard read+resolve only for MVP).

## Cross-cutting changes

**Sidebar:** adds Playlists, Schedules, Incidents nav items. Phase 1's "only show what works" rule is satisfied because all three now work.

**ScreenManager:** routes nav to the new pages.

**Settings page:** real form (no longer a stub). Fields: alert webhook URL, toggles for offline/reboot triggers, cooldown minutes, "Send test alert" button. Read-only summary for the rest (link to docs for now).

**ScreensPage incident bar:**
- `DIAGNOSE` already opens the offline screen's drill panel (Phase 1 behaviour).
- `ALERT TEAM` button now actually fires the alerter for the screen.

**Heartbeat handler:** heavier — needs to resolve schedule → playlist → URLs and possibly mutate `currentUrl` semantics. Pi behaviour unchanged because the response shape (`urls`, `refresh`, `forceRefreshAt`) is preserved.

## Tests (server)

- `alerter.test.js` — cooldown logic (same key inside cooldown → no fire; outside → fires; different keys never blocked).
- `scheduler.test.js` — `pickActive` for: no schedules; one matching; one matching another screen; overlapping with most-recent winning; outside any window; day-of-week boundaries.
- Existing 24 Phase 1 + Phase 2 tests must still pass.

No tests for CRUD endpoints — they're trivial JSON pass-throughs and the dashboard exercises them.

## Out of scope (future)

- Drag-to-create on the schedule grid.
- Manual incidents from the drill panel.
- Per-recipient targeting (Slack channel routing). One webhook to rule them all in MVP.
- Email/SMS/push notification channels.
- Playlist preview thumbnails.
- Schedule timezone awareness — assumes server local time.
