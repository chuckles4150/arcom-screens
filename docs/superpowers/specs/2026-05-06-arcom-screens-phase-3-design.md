# Arcom Screens — Phase 3: Pi log streaming

**Date:** 2026-05-06
**Branch:** `redesign/kiosks` (continuing on top of Phase 2)
**Author:** Chuck (with Claude)

## Goal

Wire the disabled `Console` button in the DrillPanel to real Pi logs. User clicks → modal opens with terminal-style live log tail, three tabs (Journal / Dmesg / Syslog), auto-scroll-to-bottom unless the user has scrolled up.

## Approach

**Pi piggybacks log lines on the existing heartbeat.** Why:
- Pis are outbound-only (no inbound connectivity from the dashboard / server).
- Heartbeats already happen every 30 s; reusing them avoids spinning up another loop or HTTP connection.
- Logs arrive in batches with up to ~30 s of latency. For a debugging tool that's fine — and it's the cost of avoiding a long-lived inbound channel.

**Server keeps recent lines in memory only.** No disk persistence — server restart loses recent logs. Acceptable; the next heartbeat refills the buffer.

## Pi side (`pi-client/kiosk.sh`)

New helper `collect_logs()` returning a JSON object with three arrays:

```json
{
  "journal": ["May 06 22:31:14 pi-test arcom-kiosk[1234]: launching chromium → ...", ...],
  "dmesg":   ["[12345.678] usb 1-1: USB disconnect, device number 4", ...],
  "syslog":  ["May  6 22:31:14 pi-test systemd[1]: Started Arcom Kiosk Display.", ...]
}
```

Sources and commands:

- **Journal**: `journalctl -u arcom-kiosk --since=@<lastHeartbeatEpoch> --no-pager -o short-iso --no-hostname` capped at 30 lines.
- **Dmesg**: `dmesg --since="30 sec ago" --time-format=iso --no-pager` capped at 20 lines (kernel messages tend to be infrequent and bursty when they happen).
- **Syslog**: `tail -n 30 /var/log/syslog` then filter to lines newer than last heartbeat by parsing the syslog timestamp. Cap at 30 lines.

Per-heartbeat caps protect against a chatty source flooding the buffer (e.g. a tight crash loop dumping thousands of journal lines). Older content is implicitly dropped — that's OK for a debugging tool.

Caches the last heartbeat epoch in `/tmp/arcom-kiosk-last-hb`. The first heartbeat after Pi boot uses "now − 60s" as the lower bound so the first Console click shows ~1 minute of history.

The heartbeat payload extends:

```json
{
  "hostname": "pi-test",
  "currentUrl": "...",
  "metrics": { ... },
  "logs": { "journal": [...], "dmesg": [...], "syslog": [...] }
}
```

## Server side

**`server/src/storage.js`** — three new in-memory ring buffers (no disk):

```js
const logBuffers = {}; // screenId → { journal: [...], dmesg: [...], syslog: [...] }
const MAX_LOG_LINES_PER_SOURCE = 500;
```

Helpers:

- `appendLogLines(screenId, source, lines)` — push, trim to MAX, return the new last-index.
- `getLogLines(screenId, source, sinceIdx)` — return `{ lines, lastIdx }` where `lastIdx` is the index of the last line in the buffer. Caller passes its previous `lastIdx` as `sinceIdx`; we return only what's been added since.
- `clearLogBuffers(screenId)` — called from the screen-delete path.

This lives in memory only. If the Pi 5 server restarts, log buffers reset; the next heartbeat begins refilling. No `metrics.json` analogue.

**`server/src/routes/screens.js`** — heartbeat handler accepts `logs` field; calls `appendLogLines(screen.id, source, lines)` for each of `journal | dmesg | syslog`.

New endpoint `GET /api/screens/:id/logs?source=journal&since=<idx>` returns:

```json
{ "lines": ["...", "..."], "lastIdx": 142 }
```

## Dashboard

**`dashboard/src/api.js`** — one new helper:

```js
screenLogs: (id, source, since = 0) =>
  request('GET', `/api/screens/${id}/logs?source=${encodeURIComponent(source)}&since=${since}`),
```

**`dashboard/src/components/screens/ConsoleModal.jsx`** (new) — terminal-style modal:

- Three tabs (Journal / Dmesg / Syslog), each driving its own state slot: `lines`, `lastIdx`.
- On tab open: poll `api.screenLogs(id, source, lastIdx)` every 3 s. Append new `lines`, update `lastIdx`.
- Auto-scroll-to-bottom by default. If user manually scrolls up by >40 px, freeze auto-scroll and show a "Jump to bottom" pill. Resumes when user scrolls back down or clicks the pill.
- Pause/resume toggle in the modal header.
- Monospace JetBrains Mono, sand background like the design's mono blocks.
- Wide modal (~960 px) so journal lines aren't truncated. Scales down on narrow viewports.

**`dashboard/src/components/screens/DrillPanel.jsx`** — Console action button is now enabled. Click sets a `consoleScreen` state in DrillPanel, which renders `<ConsoleModal />`. Tooltip changes from "Pi logs arrive in Phase 2" to "Live Pi logs (≈30 s latency)".

## Verification

- Server `npm test` still passes (no test changes).
- Dashboard `npm run build` succeeds.
- Smoke test (manual, on Pi or with a fake heartbeat curl carrying a `logs` field): heartbeat lands, `GET /api/screens/<id>/logs?source=journal&since=0` returns the lines, ConsoleModal renders them.

## Out of scope (for Phase 3)

- Search / filter / regex inside the modal — leave for a follow-up.
- Download-as-file button.
- Real-time streaming (SSE / WebSocket).
- Disk persistence for log buffers.

## Future-phase reminder

Still to come: Phase 4 Alerts, Phase 5 Playlists, Phase 6 Schedules, Phase 7 Incidents.
