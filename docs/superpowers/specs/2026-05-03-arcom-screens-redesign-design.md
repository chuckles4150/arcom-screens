# Arcom Screens — Dashboard Redesign

**Date:** 2026-05-03
**Author:** Chuck (with Claude)
**Source design:** `claude.ai/design` bundle `bHWlteUhAJ4N4_Ke4ESUZQ` — see chat transcript and `Screens.html` / `components.jsx` / `pages.jsx` / `colors_and_type.css` in the bundle.
**Status:** Ready for implementation planning.

## Context

The current dashboard at `dashboard/src/components/ScreenManager.jsx` is a 1024-line monolith that uses hard-coded demo data — it never calls the existing `/api/screens` or `/api/activity` endpoints. The Pi heartbeat + screenshot infrastructure on the server side works correctly but isn't surfaced.

Chuck commissioned a redesign through the AI design tool to address: cramped layout, weak metric visualisation, and no visual hierarchy. The design returns a polished management UI with rich per-screen detail, but it's substantially larger in scope than what the project currently has and assumes per-screen fields the server doesn't track.

This spec covers what we agreed to build, on which branch, and in what order.

## Goals

- Replace the existing dashboard UI with the design's visual language: navy sidebar, hero metric cards with sparklines, conditional incident bar, screen tile grid with snapshot previews, rich drill-in side panel, redesigned Activity page.
- Wire the dashboard to the real server API. Stop hard-coding demo data.
- Decompose the monolithic `ScreenManager.jsx` into focused per-component files.
- Ship in two phases on separate branches so visible UI improvement lands before Pi-side instrumentation.

## Non-goals

- Playlists, Schedules, and Incidents pages from the design. These are entirely new content-management subsystems with no backend. Out of scope, not just deferred.
- The 7 demo "what each Pi displays" mock pages from the design bundle (canteen-roster, loadingbay-safety, printroom-sales, etc.). They were iframe filler in the design. Real screens point at `arcom.site/dashboard/*`.
- The Tweaks panel (`tweaks-panel.jsx`). It was a design-time tool and has no place in production.
- Live iframe previews for screen tiles. Production URLs are on `arcom.local` (LAN-only); cross-origin iframes are flaky. Snapshots from the existing screenshot pipeline are reliable and cross-network.
- "Coming soon" stubs for unbuilt nav items. The sidebar shows only what works (Screens, Activity, Settings).
- Multi-user / session concept. Single user (`'Chuck'` hard-coded in activity log) stays for Phase 1.

## Phase split

The work is split across two branches, both already created off `main`:

### `redesign/server` — Phase 1

Dashboard UI redesign + minimal server-side support to back it. Does not touch Pi client. Ships first; visible improvement immediately.

### `redesign/kiosks` — Phase 2

Pi client instrumentation: extends heartbeat with process uptime, network bandwidth (from `/proc/net/dev`), restart count (from systemd), and round-trip lag. Server stores rolling history per screen. Dashboard reveals previously-hidden cards (Bandwidth · 24h, Restarts · 7d, Response time). Out of scope for this spec — separate brainstorm before that work begins.

This spec covers Phase 1 only.

## File structure (Phase 1, on `redesign/server`)

```text
dashboard/src/
  App.jsx                       # unchanged: auth gate
  main.jsx                      # unchanged
  api.js                        # add helpers for new endpoints; auth flow unchanged
  theme.js                      # CSS variables in JS form for inline-style consumers
  index.css                     # @import google fonts, set CSS variables, global resets
  components/
    Login.jsx                   # restyle to match new palette; behaviour unchanged
    ScreenManager.jsx           # shell + nav routing only (~80 lines)
    Sidebar.jsx
    Topbar.jsx
    pages/
      ScreensPage.jsx           # hero metrics + filter chips + view toggle + tile grid / table
      ActivityPage.jsx          # day-grouped event log + summary cards + kind filters
      SettingsPage.jsx          # existing scope, restyled
    screens/
      ScreenTile.jsx
      ScreenTable.jsx
      DrillPanel.jsx
      AddScreenModal.jsx
      EditScreenModal.jsx
      MetricCard.jsx            # reusable: total / online / offline / rotating
      Sparkline.jsx
      StatusChip.jsx
    activity/
      ActivityRow.jsx
      ActivityFilters.jsx

server/src/
  uptime.js                     # NEW: derive uptime % + 7-day history from activity log
  routes/screens.js             # extend: add snapshotAt + uptime endpoint
  routes/network.js             # NEW: GET /api/network/summary
  watchdog.js                   # verify status-change events are logged with timestamps

dashboard/public/
  logo-reversed.svg             # copied from design bundle
```

The existing `dashboard/src/components/styles.js` (the `T = { ... }` token object) is replaced by `theme.js`, which uses the design's full token names (e.g. `arcNavy`, `arcSage700`, `fgBrand`) instead of the abbreviated ones. The names match `colors_and_type.css` so anyone working from the design bundle can map tokens 1:1.

## Visual system & app chrome

**Theme tokens** mirror the design bundle's `colors_and_type.css`:

- Brand: `arc-navy` (#002B49), `arc-sage` (#7BA06A), `arc-yellow` (#FFB627), each with `-700/-500/-300/-100` shades
- Neutrals: `arc-bone` (#FAF7F2 — app background), `arc-cream`, `arc-sand`, `arc-char` (text), `arc-taupe`
- Semantic: `fg-1/2/3`, `fg-brand`, `bg-app/surface/surface-alt/inset`, `status-ok/warn/danger` and their `-bg` variants
- Lines, shadows, radii, motion durations
- Type families: Montserrat (display), Open Sans (body), JetBrains Mono (mono) — already imported via Google Fonts

**Sidebar** (`Sidebar.jsx`) — 232px wide, navy background, sticky to viewport.

- Top: Arcom logo (`logo-reversed.svg`)
- Eyebrow `SCREEN MANAGER` + version/host string in mono
- Nav items: Screens (with screen count badge), Activity, Settings — yellow `border-left: 3px solid` accent and yellow text on active
- Bottom: server-status card (sage tint, status dot + "SERVER ONLINE" + IP/uptime in mono); user footer (avatar circle + name/role + log-out icon, click triggers `clearStoredPassword()` from `api.js` and reloads)

**Topbar** (`Topbar.jsx`) — 56px tall, white, bottom hairline border.

- Search field on the left (max ~380px), with search icon and bone-tinted background — on the Screens page, filters the visible tile/table set by name/location/URL substring. The hero metric cards always reflect network totals regardless of search/filter (filtering the user's view doesn't change reality). No-op on other pages.
- Live network status pill on the right: dots + counts (`N online · M rotating · K offline`)
- Add screen button (primary navy filled pill)

**Page chrome inside main area:**

- Page-head pattern: eyebrow (uppercase, mono) + Montserrat title + subtitle + 56px yellow accent rule
- Right side of page-head: page-specific summary stat (e.g. network health % on Screens, event count on Activity)

## Screens page

**Conditional incident bar.** Renders only when `counts.offline > 0`. Navy gradient strip with yellow "ATTENTION" pill, offline screen names, last-contact timestamp, two actions:

- `DIAGNOSE` — opens drill panel scoped to the first offline screen
- `ALERT TEAM` — Phase 1 toast: "Team alerts arrive in Phase 2." Phase 2 wires to a real notifier.

**Hero metric row** — 4 cards via `MetricCard.jsx`:

- **Total** — count + "N sites" sub + 7-day mini bar chart of network size
- **Online** — count "of total" + 7-day uptime sparkline (sage)
- **Offline** — count + names + 7-day offline-count bar chart; flips to navy bg with yellow text when count > 0
- **Rotating** — count + "URLs/hour avg" + sparkline

For Phase 1, all sparklines are populated from `GET /api/network/summary`. If a card has no historical data yet (fresh install), the sparkline area is empty (just the number, no chart). Don't fake placeholders.

**Controls row.** Left: status filter chips (`All N · Online · Offline · Rotating`). Right: `N of M shown` count + grid/table view toggle (segmented control).

**Screen tiles, grid view** (`ScreenTile.jsx`) — `repeat(auto-fit, minmax(280px, 1fr))`, 16px gap.

- 16:9 preview area: latest screenshot from `/screenshots/<hostname>.png`. If no snapshot exists, render a colored placeholder block with a color hashed from the hostname (stable per-screen).
- Status chip overlay top-left; rotating badge top-right with URL count when `urls.length > 1`
- Hover actions bottom-right (open external, force refresh, edit) — fade in via opacity transition
- Body: name (Montserrat 14/600), `hostname · IP` (mono 10/taupe), current URL pill (cream bg, mono), foot row (`Refresh: Nm` or `Rotating · N URLs`, separator dot, `Seen Xs ago`)
- Beneath the foot row, small mono caption: `Snap N min ago` (from `snapshotAt`), or hidden if no snapshot
- Tile click → opens drill panel

**Table view** (`ScreenTable.jsx`) — alternative dense view. Columns: SCREEN / HOSTNAME / URL / REFRESH / STATUS / LAST SEEN, plus per-row actions (preview / refresh / edit). Same data, no thumbnail.

**Empty state.** When no screens exist at all: centered "Register your first screen" CTA opening AddScreenModal. When a filter returns zero rows: centered "No screens match this filter" + clear-filter button.

## Drill-in panel

Right-side drawer, 420px wide on desktop, full-screen on mobile. Closes via X, escape key, or scrim click.

**Header.** Eyebrow `SCREEN DETAIL`, big screen name, status chip inline, close button.

**Big preview.** 16:9, 320–400px tall. Caption underneath in mono: `Snap N min ago · <currentUrl>`. If rotating, a small chip below names the current URL and shows `Rotating · next change in Xm` (where the timer is computed from `currentUrl` + the rotation entry's `duration` — best-effort estimate, not exact).

**Action row.** Four pill buttons:

- `Force refresh` → `POST /api/screens/:id/refresh`
- `Edit settings` → opens EditScreenModal
- `Open URL` → opens current URL in new tab
- `Console` (Phase 2 placeholder) — disabled in Phase 1, tooltip: "Pi logs arrive in Phase 2"

**Stats grid.** 2×2 cards. **In Phase 1, only the first is rendered:**

- **Uptime · 7d** — % + sparkline from `GET /api/screens/:id/uptime?window=7d`

Phase 2 reveals: Bandwidth · 24h, Restarts · 7d, Response time.

**Rotation schedule** (only when `urls.length > 1`). Vertical list:

- Number badge (1, 2, 3…) navy circle
- URL text (mono, truncated)
- Duration (`30s`, `2m`)
- `NOW` chip on the entry matching `currentUrl`

**Recent activity** — last 10 events for this screen via `GET /api/activity?screen=<name>&limit=10`. Each row: icon (sage/yellow/danger), text, relative time. "View all" link at bottom opens Activity page pre-filtered to this screen.

**Detail rows** at the bottom: Hostname (mono), IP (mono), Mode (Single URL / Rotating · N URLs), Reload interval, Last seen (mono), Created date, Location.

**Footer.** Duplicate `Force refresh` (ghost) and `Edit settings` (primary) for convenience after scrolling. Plus a small `Remove screen` ghost link in danger color with confirm step — moved here from EditScreenModal so deletion is one fewer click.

## Activity page

Same chrome as Screens page.

**Page-head.** Eyebrow + title `Activity` + subtitle `Every event across the screen network` + yellow accent rule. Right side: today's event count in big Montserrat numerals.

**Summary metric row** — 4 cards (`SummaryStat` pattern):

- **Incidents · 24h** (danger) — count of `type: 'offline'`
- **Refreshes · 24h** (sage) — count of `type: 'refresh'`
- **Content updates · 24h** (navy) — count of `type: 'edit'`
- **System events · 24h** (yellow) — count of `type: 'add' | 'remove' | 'online'`

Each shows comparison vs. yesterday (`↑ 2 vs yesterday`).

**Filter chips.** `All · Incidents · Refreshes · Content · System`, navy pill when active. Maps to the same kind groupings.

**Day-grouped event list.** Events grouped under day headers (`TODAY`, `YESTERDAY`, then `MON 28 APR` style). Each group has a subheader with horizontal rule and per-day count.

**Event rows.** Same general shape as today's UI but with new tokens:

- Per-kind icon (lucide name + color) covering all event types we emit (`refresh`, `edit`, `online`, `offline`, `add`, `remove`, `rotation`)
- Screen name (Montserrat 600); detail (body sans); relative time (right)
- Hover: row tints to `--bg-app`; screen name becomes a link to that screen's drill panel

**Empty state.** When a filter returns zero rows: "No matching events" + clear-filter.

**Pagination.** Server already caps at 500 entries and supports `?limit=`. Phase 1: load 100 by default; `Load more` ghost button extends the limit (keeps server changes minimal).

**Filtering by kind is client-side.** The existing `?type=` API filter only matches single types; rather than extend the API, the dashboard fetches all 100 and filters in-browser. ≤500 rows, trivial.

## Server-side support (Phase 1)

**1. Verify watchdog logs status transitions.** During implementation, read `server/src/watchdog.js` to confirm `offline` and `online` events are appended to the activity log with accurate timestamps. Uptime computation depends on this. If the watchdog is silent or imprecise, fix it — small change.

**2. New endpoint: `GET /api/screens/:id/uptime?window=7d`** — returns:

```json
{ "uptimePct": 99.4, "history": [98, 99, 100, 99, 100, 99, 99.4] }
```

Pure derivation: replay activity log's status-change events for that screen plus current `status`/`lastSeen` to compute online-minutes per day for the last 7 days. No new storage. Implemented in `server/src/uptime.js` so the logic is unit-testable.

**3. New endpoint: `GET /api/network/summary`** — single call returning counts + 7-day sparklines for the hero metric row:

```json
{
  "counts": { "total": 12, "online": 9, "offline": 2, "rotating": 3 },
  "history": {
    "total":    [8, 9, 10, 10, 11, 11, 12],
    "online":   [97, 98, 96, 99, 98, 97, 97.4],
    "offline":  [0, 1, 0, 0, 1, 1, 2],
    "rotating": [2, 3, 2, 4, 3, 5, 3]
  },
  "uptimePct7d": 97.4
}
```

Saves the dashboard from making 12 individual uptime calls per refresh.

**4. Add `snapshotAt` to screen objects** in `GET /api/screens` and `GET /api/screens/:id` responses — ISO timestamp of the screenshot file's mtime, or `null` if no snapshot exists. Avoids a second API round-trip for "Snap N min ago".

**5. No demo seed data.** Empty install → empty state with first-screen CTA. Cleaner than fake screens.

**6. Activity log `user` field stays hard-coded `'Chuck'`** for Phase 1. Multi-user is out of scope.

## Data flow & auto-refresh

**Per-page polling.** No global store needed at this size — `useState` + `useEffect` per page.

- `ScreensPage`: on mount, fetches `GET /api/screens` and `GET /api/network/summary` in parallel. Re-fetches every 15s. Pauses when `document.visibilityState === 'hidden'` (saves Pi 5 CPU).
- `ActivityPage`: fetches `GET /api/activity?limit=100` on mount, polls every 30s.
- `DrillPanel`: on open, fetches `GET /api/screens/:id/uptime?window=7d` and `GET /api/activity?screen=<name>&limit=10`. No polling — close+reopen is the refresh.

**Optimistic updates.** Add / edit / delete / force-refresh update local state immediately, then reconcile with the server response. On failure, revert and show an error toast (existing toast pattern in `ScreenManager.jsx` carries over).

**Error handling.** A small `useFetch(loaderFn, deps)` hook returning `{ data, error, loading, refetch }`. Error state renders an inline banner with `Retry`, not a full-page crash. Auth failures (401) already trigger logout via `request()` in `api.js`.

## Auth & login

The auth flow is unchanged — `App.jsx`'s gate, `Login.jsx`'s submit handler, and `api.js`'s `request()` / `getStoredPassword()` / `clearStoredPassword()` helpers all behave exactly as today. `api.js` gains new helper methods (`api.networkSummary()`, `api.screenUptime(id, window)`) wrapping the new endpoints. `Login.jsx` is restyled to use the new theme tokens but its logic is untouched.

## Verification plan

Before declaring Phase 1 complete:

- `cd dashboard && npm run dev` — exercise: register a screen via AddScreenModal; force-refresh; verify a tile and the activity log update; toggle grid/table; filter by status; open drill panel; edit; delete.
- `cd server && npm start` against a fresh empty `data/` — confirm empty-state CTA appears.
- Manual heartbeat: `curl -X POST http://localhost:8080/api/pi/heartbeat -d '{"hostname":"pi-test","currentUrl":"https://example.com"}' -H 'Content-Type: application/json'` — confirm screen flips to online and "Seen Xs ago" updates.
- Confirm `redesign/kiosks` branch is untouched — no Pi-side files modified by Phase 1.
- Visual-correctness check is the user's responsibility; Claude can't load the dashboard in a browser from inside its environment. Claude reports type-check + smoke-test pass; user confirms the visuals match the design.

## Risk register

- **Snapshot cadence is unknown.** During implementation, read `pi-client/kiosk.sh` to confirm how often Pis upload screenshots. If it's only on heartbeat (~1 min), tiles will show slightly stale images. Acceptable; the `Snap N min ago` caption is honest about it. If it's longer, consider asking the user whether to bump it (separate decision, not part of Phase 1).
- **Watchdog status logging.** If watchdog doesn't log status transitions to the activity log with timestamps, uptime computation is broken. Mitigation: verify and fix as the first server-side step.
- **Empty installs have no sparklines.** Fresh install + new screen = no history yet. Spec is explicit: empty sparkline area, no fake placeholders. UX-acceptable; data fills in over the first week.
- **Polling load.** 15s polling × N viewers × `(GET /api/screens + GET /api/network/summary)` is trivial for small N but worth noting. If many concurrent dashboards become a thing (unlikely for a one-office tool), revisit with SSE/websocket.

## Out-of-scope reminder (deferred to later brainstorm)

Phase 2 work, on `redesign/kiosks`:

- Pi heartbeat schema: process uptime, bandwidth (`/proc/net/dev`), restart count (systemd), round-trip lag
- Server storage for those rolling metrics
- Dashboard reveals previously-hidden cards (Bandwidth · 24h, Restarts · 7d, Response time)
- Pi log streaming (powers the disabled `Console` button)
- Real "Alert team" notifier wiring

Truly out of scope (no current plan):

- Playlists, Schedules, Incidents pages
- Multi-user / sessions
- Ship the 7 mock content pages from the design bundle
- Tweaks panel
