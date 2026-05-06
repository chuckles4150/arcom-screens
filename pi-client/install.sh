#!/usr/bin/env bash
# Run this once on each new Pi 3 after flashing Pi OS Lite.
#   curl -sSL https://raw.githubusercontent.com/<chuck>/arcom-screens/main/pi-client/install.sh | sudo bash
# Or copy the repo manually and run:  sudo ./install.sh

set -euo pipefail

if [[ "$EUID" -ne 0 ]]; then
  echo "must be run as root (try: sudo $0)"
  exit 1
fi

if [[ -z "${SUDO_USER:-}" ]]; then
  echo "SUDO_USER is not set — run with sudo, not as root directly"
  exit 1
fi

KIOSK_USER="$SUDO_USER"
KIOSK_HOME="/home/$KIOSK_USER"
KIOSK_UID=$(id -u "$KIOSK_USER")
INSTALL_DIR="$KIOSK_HOME/arcom-kiosk"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "── Arcom Kiosk Installer ──"
echo "Installing for user: $KIOSK_USER (uid $KIOSK_UID)"
echo

# 1. Install dependencies
echo "[1/7] Installing packages..."
apt-get update
apt-get install -y --no-install-recommends \
  xserver-xorg \
  xinit \
  x11-xserver-utils \
  chromium \
  scrot \
  unclutter \
  xdotool \
  jq \
  curl \
  bc

# 2. Allow non-root users to start X server (required for systemd to startx)
echo "[2/7] Allowing X server start by users..."
cat > /etc/X11/Xwrapper.config <<EOF
allowed_users=anybody
needs_root_rights=yes
EOF

# 3. Set up the kiosk directory
echo "[3/7] Setting up kiosk directory..."
mkdir -p "$INSTALL_DIR"
cp "$REPO_DIR/kiosk.sh" "$INSTALL_DIR/kiosk.sh"
chmod +x "$INSTALL_DIR/kiosk.sh"
chown -R "$KIOSK_USER:$KIOSK_USER" "$INSTALL_DIR"

# 4. Disable any existing tty1 auto-login (we replace it with the systemd service)
echo "[4/7] Removing legacy auto-login..."
rm -f /etc/systemd/system/getty@tty1.service.d/override.conf
rm -f "$KIOSK_HOME/.bash_profile"
rm -f "$KIOSK_HOME/.xinitrc"
systemctl daemon-reload

# 5. Install the systemd service
echo "[5/7] Installing arcom-kiosk.service..."
sed "s|KIOSK_USER_PLACEHOLDER|$KIOSK_USER|g; s|XDG_RUNTIME_DIR=/run/user/1000|XDG_RUNTIME_DIR=/run/user/$KIOSK_UID|" \
  "$REPO_DIR/arcom-kiosk.service" > /etc/systemd/system/arcom-kiosk.service

systemctl daemon-reload
systemctl enable arcom-kiosk.service

# 6. Set up logging
echo "[6/7] Setting up logging..."
touch /var/log/arcom-kiosk.log
chown "$KIOSK_USER:$KIOSK_USER" /var/log/arcom-kiosk.log

# 7. Done
echo "[7/7] Done."
echo
echo "── Next steps ──"
echo "1. Set the server URL in: $INSTALL_DIR/kiosk.sh"
echo "   (look for SERVER= near the top, default http://n8n.local:8080)"
echo "2. Register hostname '$(hostname)' in the dashboard."
echo "3. Start the kiosk:"
echo "     sudo systemctl start arcom-kiosk"
echo "   Or just reboot — it auto-starts on boot."
echo
echo "── Useful commands ──"
echo "  Check status:    sudo systemctl status arcom-kiosk"
echo "  Live logs:       sudo journalctl -u arcom-kiosk -f"
echo "  Kiosk script log: tail -f /var/log/arcom-kiosk.log"
echo "  Restart:         sudo systemctl restart arcom-kiosk"
echo "  Stop (debug):    sudo systemctl stop arcom-kiosk"
