# Arcom Screens — Setup

## 1. Pi 5 server

Clone, copy the env file, run docker:

```bash
cd ~
git clone https://github.com/chuckles4150/arcom-screens.git
cd arcom-screens
cp .env.example .env
nano .env  # set DASHBOARD_PASSWORD
docker compose up -d --build
```

Server is now on `http://n8n.local:8080`.

## 2. Cloudflare tunnel

Edit `/etc/cloudflared/config.yml` to add:

```yaml
- hostname: screens.chucklesdev.com
  service: http://localhost:8080
```

(Order matters — must come BEFORE the `http_status:404` catch-all.)

Restart cloudflared:

```bash
sudo systemctl restart cloudflared
```

Add CNAME `screens` → `<tunnel-uuid>.cfargotunnel.com` in Cloudflare DNS.

## 3. Pi 3 kiosk client

Flash Pi OS Lite 64-bit with Imager. Set:

- Hostname: `pi-<location>` (e.g. `pi-printroom`)
- Username: anything you like
- Enable SSH
- Configure WiFi

Boot, SSH in, then:

```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/chuckles4150/arcom-screens.git
cd arcom-screens/pi-client
chmod +x install.sh kiosk.sh
sudo ./install.sh
```

Register the screen in the dashboard (must match the Pi's hostname),
then `sudo reboot`. The Pi auto-logs in, starts X, launches Chromium
fullscreen, and phones home.

## 4. Updating

When the repo changes, on each Pi 3:

```bash
cd ~/arcom-screens
git pull
sudo cp pi-client/kiosk.sh ~/arcom-kiosk/kiosk.sh
sudo chmod +x ~/arcom-kiosk/kiosk.sh
sudo reboot
```

On the Pi 5:

```bash
cd ~/arcom-screens
git pull
docker compose up -d --build
```

## 5. Logs

On Pi 3: `tail -f /var/log/arcom-kiosk.log`
On Pi 5: `docker logs arcom-screens -f`
