# Arcom Screens — Phase 2: Pi instrumentation + systemd launch

**Date:** 2026-05-06
**Branch:** `redesign/kiosks` (merged on top of `redesign/server` Phase 1)
**Author:** Chuck (with Claude)

## Goals

1. Switch Pi 3 kiosk launch from autologin + `.xinitrc` to a proper **systemd service** so a Chromium crash → instant restart and the boot path is observable via `journalctl`.
2. Extend the Pi heartbeat with **system metrics**: uptime + reboot detection, bandwidth (RX/TX cumulative), heartbeat round-trip lag, load average + memory.
3. Server stores a **ring buffer of metric samples** per screen and exposes them via `GET /api/screens/:id/metrics?window=24h`.
4. Dashboard reveals the previously-hidden cards in the DrillPanel: Bandwidth · 24h, Restarts · 7d, Response time. Plus a Load + Memory card.

## Non-goals

- Real "Alert team" notifier wiring (still later).
- Pi log streaming (`Console` button — still disabled).
- systemd service restart count — using uptime-based reboot detection covers the more useful signal (whole-Pi reboots, not service-restart noise from Chromium crashes inside the same boot).

## Pi-side changes (`pi-client/`)

**`arcom-kiosk.service`** (new, replaces the simple version) — placeholders for `KIOSK_USER_PLACEHOLDER` and `XDG_RUNTIME_DIR=/run/user/1000` get sed-substituted by `install.sh`. Owns the X server via `startx`, runs `kiosk.sh` as the user, restarts on failure with backoff.

**`install.sh`** (replaced) — adopts the systemd-based version the user already drafted: removes legacy `.xinitrc`/autologin, allows non-root X via `Xwrapper.config`, installs the service, enables on boot.

**`kiosk.sh`** (extended) — `heartbeat_loop` reads from `/proc/uptime`, `/proc/net/dev`, `/proc/loadavg`, `/proc/meminfo` plus its own internal lag tracker, and packs them into a `metrics` object on the heartbeat POST. New helper functions `collect_metrics()` returning a JSON object via `jq -n`. The heartbeat also captures the request-RTT into a file the *next* heartbeat reads, so `lastLagMs` is always one cycle behind (acceptable — 30 s jitter).

Heartbeat payload:

```json
{
  "hostname": "pi-test",
  "currentUrl": "https://...",
  "metrics": {
    "systemUptimeSec": 124567,
    "bandwidthRxBytes": 8675309000,
    "bandwidthTxBytes": 1234567000,
    "loadAvg1m": 0.34,
    "memUsedMb": 412,
    "memTotalMb": 924,
    "lastLagMs": 84
  }
}
```

## Server-side changes

**`server/src/storage.js`** — new metrics file:

```text
data/metrics.json  → { "<screen-id>": [{ ts, ...sample }, ...newest first ] }
```

Cap at **5000 samples per screen** (~42 hours at 30 s heartbeat — comfortably more than the 24h window). Append on every heartbeat.

Helpers: `appendMetricSample(screenId, sample)`, `getMetricSamples(screenId, sinceMs)`.

**`server/src/routes/screens.js`** — extend `piClient.post('/heartbeat')`:

1. Accept the `metrics` field on the body.
2. If present, call `appendMetricSample(screen.id, { ts: now, ...metrics })`.
3. **Reboot detection**: compare incoming `systemUptimeSec` to the previous sample's `systemUptimeSec` for the same screen. If the new value is *less* than the previous one (with a small grace), log a `boot` activity event (`type: 'boot'`, detail "Pi rebooted after Xd Yh"). The dashboard's "Restarts · 7d" count derives from this activity log entry, same pattern as Phase 1 uptime.
4. Capture `req.startTime` (Express timing middleware) — server doesn't measure RTT itself; that's done by the Pi.

**`server/src/metrics.js`** (new) — pure aggregation module akin to `uptime.js`:

```js
export function computeMetricsWindow(samples, activity, screenName, opts = {})
// Returns { bandwidth: {rxMb24h, txMb24h, rxHistory, txHistory},
//           restarts: { total7d, history }, responseTime: { p50, p95, history },
//           load: { avg, history }, memory: { usedMb, totalMb } }
```

History arrays follow the Phase 1 sparkline convention (oldest → newest, daily buckets for 7d windows, hourly for 24h).

**`server/src/routes/screens.js`** — new endpoint:

```text
GET /api/screens/:id/metrics?window=24h | 7d
```

Returns the `computeMetricsWindow` output. Default window = 24h.

**Activity log additions** — the heartbeat handler emits a new `'boot'` event type when reboot is detected. The Phase 1 `kindOf()` mapping in `ActivityFilters` already buckets unknown types into `system`, so it shows up under the System chip without code changes.

## Dashboard changes

**`dashboard/src/api.js`** — one new helper:

```js
screenMetrics: (id, window = '24h') =>
  request('GET', `/api/screens/${id}/metrics?window=${encodeURIComponent(window)}`),
```

**`dashboard/src/components/screens/DrillPanel.jsx`** — extend the `StatsGrid` to render four cards instead of one:

1. Uptime · 7d (already there from Phase 1)
2. **Bandwidth · 24h** — combined `rxMb + txMb`, with a 24h sparkline
3. **Restarts · 7d** — count, list of recent boot events as a small caption
4. **Response time** — p50 (big number) + p95 (sub) + sparkline of recent samples

Grid lays out 2×2; collapses to 1×4 on narrow drawer.

A 5th card (Load + memory) appears below the grid as a wide card if `metrics.load.avg != null`. Optional, doesn't fight for slot.

**Drill panel data flow** — open: fire two parallel fetches (uptime + metrics). Refresh on close+reopen, no polling inside the drawer.

## Verification plan

- `npm test` in server still passes (Phase 1 tests).
- New `metrics.test.js` covers bandwidth-delta computation, reboot detection, lag percentile math.
- `npm run build` in dashboard succeeds.
- Smoke: send a fake heartbeat with `metrics` payload via `curl`; confirm a sample lands in `data/metrics.json` and the new endpoint returns it.
- Pi deploy plan written into the README handoff at the end.

## Out of scope (future phases)

- Pi log streaming for the `Console` action.
- Real notifications wiring.
- Playlists / Schedules / Incidents pages.
