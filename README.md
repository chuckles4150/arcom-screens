# arcom-screens

Self-hosted digital signage for the Arcom office. Manages a network of
Raspberry Pi displays from a central dashboard.

## Architecture

```
┌─────────────────────────────────────┐
│  Pi 5 (n8n.arcom — Docker host)     │
│  ┌──────────────┐  ┌──────────────┐ │
│  │  server      │  │  dashboard   │ │
│  │  (Express)   │  │  (React)     │ │
│  └──────────────┘  └──────────────┘ │
│         ▲                  ▲        │
└─────────┼──────────────────┼────────┘
          │                  │
          │ heartbeat         │ HTTPS via cloudflared
          │ + screenshot      │ → screens.arcom.site
          │                  │
   ┌──────┴──────┐    ┌──────┴───────┐
   │  Pi 3 #1    │    │   Browser    │
   │  Workshop   │    │   (Chuck)    │
   └─────────────┘    └──────────────┘
   ┌─────────────┐
   │  Pi 3 #2    │
   │  Sales      │
   └─────────────┘
   ┌─────────────┐
   │  Pi 3 #3    │
   │  Reception  │
   └─────────────┘
```

## Folders

- **`server/`** — Express API. Stores screen config in JSON, receives
  heartbeats and screenshots from Pi clients, serves the dashboard.
- **`dashboard/`** — React frontend (Vite). The UI you've already
  designed, wired up to the API.
- **`pi-client/`** — Bash scripts and systemd units that run on each
  Pi 3. Boots into Chromium kiosk, fetches its config, phones home.
- **`docs/`** — Setup guides for flashing Pis, deploying the server,
  and configuring Cloudflare.

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
| Public DNS  | Cloudflare tunnel → arcom.site     |

## Status

Built April 2026 by Chuck.
