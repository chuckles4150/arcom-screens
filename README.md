# arcom-screens

Self-hosted digital signage for the Arcom office. Manages a network of
Raspberry Pi displays from a central dashboard.

## Folders

- **`server/`** — Express API. Stores screen config in JSON, receives
  heartbeats and screenshots from Pi clients, serves the dashboard
  and the fallback page.
- **`dashboard/`** — React frontend (Vite). The management UI at
  `screens.chucklesdev.com`.
- **`pi-client/`** — Bash scripts and systemd units that run on each
  Pi 3. Boots into Chromium kiosk, fetches its config, phones home,
  watchdogs Chromium, falls back to a branded error page when target
  URL is unreachable.
- **`docs/`** — Setup guides.

## Quick start

See [`docs/SETUP.md`](docs/SETUP.md) for the full deployment guide.

## Tech stack

| Layer       | Stack                              |
|-------------|------------------------------------|
| Server      | Node.js, Express, JSON file store  |
| Frontend    | React 18, Vite, Lucide icons       |
| Pi client   | Bash, Chromium, scrot, curl        |
| Deployment  | Docker Compose on Pi 5             |
| Auth        | Simple password (env var)          |
| Public DNS  | Cloudflare tunnel → chucklesdev.com|

## Status

Built April 2026 by Chuck.
