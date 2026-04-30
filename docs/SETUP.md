# Setup guide

End-to-end deployment for the Arcom screens system. Three parts:

1. **Server** — runs on the existing Pi 5 alongside n8n
2. **Cloudflare tunnel** — exposes the dashboard at `screens.arcom.site`
3. **Pi 3 clients** — flash, install, register

---

## 1. Server (Pi 5)

### Clone and configure

```bash
ssh chuck@n8n
cd ~
git clone https://github.com/<chuck>/arcom-screens.git
cd arcom-screens
cp .env.example .env
```

Edit `.env` and set a strong password:

```bash
nano .env
# DASHBOARD_PASSWORD=some-strong-password-here
```

### Build and start

```bash
docker compose up -d --build
```

This builds two Docker stages (the React dashboard, then the Express
server) and starts a single container on port 8080. Data is persisted
to `./data/` (gitignored).

### Verify

```bash
curl http://localhost:8080/api/screens \
  -H "Authorization: Bearer your-password"
# Should return: {"screens":[]}
```

### View logs

```bash
docker compose logs -f arcom-screens
```

---

## 2. Cloudflare tunnel — `screens.arcom.site`

### DNS

Since `arcom.site` is on Panthur DNS, add a CNAME there pointing to
your Cloudflare tunnel:

```
screens.arcom.site  CNAME  <your-tunnel-uuid>.cfargotunnel.com
```

If `arcom.site` isn't on Cloudflare, you'll need either:
- Move DNS to Cloudflare (cleanest, free)
- Or expose port 8080 via Panthur with separate SSL setup

### Tunnel route

On the Pi 5, edit `/etc/cloudflared/config.yml`:

```yaml
tunnel: <existing-tunnel-uuid>
credentials-file: /etc/cloudflared/<uuid>.json

ingress:
  # ... existing routes for n8n, actual budget, etc

  - hostname: screens.arcom.site
    service: http://localhost:8080

  - service: http_status:404
```

Restart cloudflared:

```bash
sudo systemctl restart cloudflared
```

Visit `https://screens.arcom.site` — should show the login page.

---

## 3. Pi 3 clients

### Flash

1. Install Raspberry Pi Imager
2. Choose **Raspberry Pi OS Lite (64-bit)** — no desktop needed
3. Click the gear icon to set:
   - **Hostname**: `pi-workshop` (or whatever — must match what you'll
     register in the dashboard)
   - **Username**: `pi`, password: anything strong
   - **WiFi**: SSID + password for the office network
   - **SSH**: enable with password
4. Flash and boot

### Install kiosk software

SSH into the Pi:

```bash
ssh pi@pi-workshop.local
```

Clone the repo and run the installer:

```bash
git clone https://github.com/<chuck>/arcom-screens.git
cd arcom-screens/pi-client
sudo ./install.sh
```

### Register in the dashboard

1. Open `https://screens.arcom.site`
2. Sign in
3. Click **Add screen**
4. Set:
   - **Name** — what you want to call it ("Workshop Floor")
   - **Hostname** — must exactly match what you set during flashing
     (e.g. `pi-workshop`)
   - **URL** — the Odoo or other dashboard URL
   - **Refresh interval** — minutes
   - **Location** — where it's mounted

### Reboot the Pi

```bash
sudo reboot
```

It should boot directly to Chromium fullscreen. The screen card in
the dashboard will go from **OFFLINE** to **ONLINE** within ~30 seconds.

The first screenshot will appear ~60 seconds after that.

---

## Updates

To update the server:

```bash
ssh chuck@n8n
cd ~/arcom-screens
git pull
docker compose up -d --build
```

To update a Pi client:

```bash
ssh pi@pi-workshop.local
cd ~/arcom-screens
git pull
sudo cp pi-client/kiosk.sh /home/pi/arcom-kiosk/kiosk.sh
sudo reboot
```

---

## Troubleshooting

**Pi shows OFFLINE in the dashboard but it's powered on**
- Check it can reach the server: `curl http://n8n.local:8080/api/screens` from the Pi
- Hostname mismatch: `hostname` on the Pi must match what's in the dashboard
- Logs: `tail -f /var/log/arcom-kiosk.log`

**Pi boots to a black screen**
- SSH in and check: `systemctl status getty@tty1`
- View kiosk log: `cat /var/log/arcom-kiosk.log`

**Screenshots not appearing**
- scrot needs the X server running. If Chromium hasn't started yet,
  scrot can't capture
- Check: `ls -la /tmp/arcom-kiosk-shot.png` to see if scrot's writing them
- Permissions issue? `ls -la /var/log/arcom-kiosk.log` should be owned by `pi`

**Dashboard shows old screenshot**
- The dashboard polls every 5s but image caching can stick. The URL
  has a cache-buster (`?t=lastSeen`) so it should refresh when the Pi
  phones home with a new lastSeen
