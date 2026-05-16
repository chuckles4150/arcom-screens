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
echo "[1/9] Installing packages..."
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
echo "[2/9] Allowing X server start by users..."
cat > /etc/X11/Xwrapper.config <<EOF
allowed_users=anybody
needs_root_rights=yes
EOF

# 3. Set up the kiosk directory
echo "[3/9] Setting up kiosk directory..."
mkdir -p "$INSTALL_DIR"
cp "$REPO_DIR/kiosk.sh" "$INSTALL_DIR/kiosk.sh"
chmod +x "$INSTALL_DIR/kiosk.sh"
chown -R "$KIOSK_USER:$KIOSK_USER" "$INSTALL_DIR"

# 4. Disable the tty1 login prompt entirely. The kiosk service owns tty1,
#    and the unit's Conflicts=getty@tty1.service makes the race impossible
#    at runtime — but for clarity we also disable getty@tty1 outright so
#    it never tries to start on boot.
echo "[4/9] Disabling getty@tty1 and removing legacy autologin..."
rm -f /etc/systemd/system/getty@tty1.service.d/override.conf
rm -f "$KIOSK_HOME/.bash_profile"
rm -f "$KIOSK_HOME/.xinitrc"
systemctl disable --now getty@tty1.service 2>/dev/null || true
systemctl daemon-reload

# 5. Enable linger so /run/user/$UID is created at boot and persists
#    even though no human ever logs in. Replaces what PAMName=login
#    used to give us.
echo "[5/9] Enabling user linger for $KIOSK_USER..."
loginctl enable-linger "$KIOSK_USER"

# 6. Install the systemd service
echo "[6/9] Installing arcom-kiosk.service..."
sed "s|KIOSK_USER_PLACEHOLDER|$KIOSK_USER|g; s|XDG_RUNTIME_DIR=/run/user/1000|XDG_RUNTIME_DIR=/run/user/$KIOSK_UID|" \
  "$REPO_DIR/arcom-kiosk.service" > /etc/systemd/system/arcom-kiosk.service

systemctl daemon-reload
systemctl enable arcom-kiosk.service

# 7. Logging — kiosk stdout/stderr flow into systemd-journald via the
#    unit's default StandardOutput/Error. View with:
#      journalctl -u arcom-kiosk -f
#    Remove the stale plain-text log file from previous installs that
#    set StandardOutput=append:/var/log/arcom-kiosk.log — it's no longer
#    written to and will only confuse future debugging.
echo "[7/9] Routing logs to journald (removing stale /var/log/arcom-kiosk.log if present)..."
rm -f /var/log/arcom-kiosk.log

# 8. Boot directly into graphical mode. The kiosk unit's
#    WantedBy=graphical.target means this is where it gets pulled in.
echo "[8/9] Setting default systemd target to graphical..."
systemctl set-default graphical.target

# 9. Done
echo "[9/9] Done."
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
echo "  Restart:         sudo systemctl restart arcom-kiosk"
echo "  Stop (debug):    sudo systemctl stop arcom-kiosk"
