#!/usr/bin/env bash
# Run this once on each new Pi 3 after flashing Pi OS Lite.
#   curl -sSL https://raw.githubusercontent.com/<chuck>/arcom-screens/main/pi-client/install.sh | sudo bash
# Or copy the repo manually and run:  sudo ./install.sh

set -euo pipefail

if [[ "$EUID" -ne 0 ]]; then
  echo "must be run as root (try: sudo $0)"
  exit 1
fi

INSTALL_DIR="/home/pi/arcom-kiosk"
SCRIPT_URL_BASE="${SCRIPT_URL_BASE:-}" # empty = local install
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "── Arcom Kiosk Installer ──"
echo

# 1. Install dependencies
echo "[1/6] Installing packages..."
apt-get update
apt-get install -y --no-install-recommends \
  xserver-xorg \
  xinit \
  x11-xserver-utils \
  chromium-browser \
  scrot \
  unclutter \
  xdotool \
  jq \
  curl

# 2. Set up the kiosk directory
echo "[2/6] Setting up kiosk directory..."
mkdir -p "$INSTALL_DIR"
cp "$REPO_DIR/kiosk.sh" "$INSTALL_DIR/kiosk.sh"
chmod +x "$INSTALL_DIR/kiosk.sh"
chown -R pi:pi "$INSTALL_DIR"

# 3. Create xinitrc — auto-start X with Chromium kiosk on tty1
echo "[3/6] Configuring X auto-start..."
cat > /home/pi/.xinitrc <<'EOF'
#!/bin/sh
exec /home/pi/arcom-kiosk/kiosk.sh
EOF
chmod +x /home/pi/.xinitrc
chown pi:pi /home/pi/.xinitrc

# 4. Auto-login pi user on tty1
echo "[4/6] Configuring auto-login..."
mkdir -p /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/override.conf <<'EOF'
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin pi --noclear %I $TERM
EOF

# 5. Auto-startx on login (~/.bash_profile)
cat > /home/pi/.bash_profile <<'EOF'
if [[ -z $DISPLAY && $XDG_VTNR -eq 1 ]]; then
  startx -- -nocursor
fi
EOF
chown pi:pi /home/pi/.bash_profile

# 6. Log file with proper permissions
echo "[5/6] Setting up logging..."
touch /var/log/arcom-kiosk.log
chown pi:pi /var/log/arcom-kiosk.log

# Done
echo "[6/6] Done."
echo
echo "── Next steps ──"
echo "1. Set the server URL by editing: /home/pi/arcom-kiosk/kiosk.sh"
echo "   (look for SERVER= near the top, default http://n8n.local:8080)"
echo "2. Set the Pi's hostname to match what's in the dashboard:"
echo "     sudo raspi-config → System Options → Hostname"
echo "3. Register this hostname in the dashboard, then reboot:"
echo "     sudo reboot"
echo
echo "Logs: tail -f /var/log/arcom-kiosk.log"
