#!/usr/bin/env bash
# Run this once on each new Pi 3 after flashing Pi OS Lite.
#   curl -sSL https://raw.githubusercontent.com/<chuck>/arcom-screens/main/pi-client/install.sh | sudo bash
# Or copy the repo manually and run:  sudo ./install.sh

set -euo pipefail

if [[ "$EUID" -ne 0 ]]; then
  echo "must be run as root (try: sudo $0)"
  exit 1
fi

# Use the real user (whoever ran sudo) — works regardless of whether
# they named themselves 'pi', 'pi-printroom', etc.
if [[ -z "${SUDO_USER:-}" ]]; then
  echo "SUDO_USER is not set — run with sudo, not as root directly"
  exit 1
fi

KIOSK_USER="$SUDO_USER"
KIOSK_HOME="/home/$KIOSK_USER"
INSTALL_DIR="$KIOSK_HOME/arcom-kiosk"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "── Arcom Kiosk Installer ──"
echo "Installing for user: $KIOSK_USER"
echo

# 1. Install dependencies
echo "[1/6] Installing packages..."
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
  curl

# 2. Set up the kiosk directory
echo "[2/6] Setting up kiosk directory..."
mkdir -p "$INSTALL_DIR"
cp "$REPO_DIR/kiosk.sh" "$INSTALL_DIR/kiosk.sh"
chmod +x "$INSTALL_DIR/kiosk.sh"
chown -R "$KIOSK_USER:$KIOSK_USER" "$INSTALL_DIR"

# 3. Create xinitrc — auto-start X with Chromium kiosk on tty1
echo "[3/6] Configuring X auto-start..."
cat > "$KIOSK_HOME/.xinitrc" <<EOF
#!/bin/sh
exec $INSTALL_DIR/kiosk.sh
EOF
chmod +x "$KIOSK_HOME/.xinitrc"
chown "$KIOSK_USER:$KIOSK_USER" "$KIOSK_HOME/.xinitrc"

# 4. Auto-login user on tty1
echo "[4/6] Configuring auto-login..."
mkdir -p /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/override.conf <<EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $KIOSK_USER --noclear %I \$TERM
EOF

# 5. Auto-startx on login (~/.bash_profile)
cat > "$KIOSK_HOME/.bash_profile" <<'EOF'
if [[ -z $DISPLAY && $XDG_VTNR -eq 1 ]]; then
  startx -- -nocursor
fi
EOF
chown "$KIOSK_USER:$KIOSK_USER" "$KIOSK_HOME/.bash_profile"

# 6. Log file with proper permissions
echo "[5/6] Setting up logging..."
touch /var/log/arcom-kiosk.log
chown "$KIOSK_USER:$KIOSK_USER" /var/log/arcom-kiosk.log

# Done
echo "[6/6] Done."
echo
echo "── Next steps ──"
echo "1. Set the server URL by editing: $INSTALL_DIR/kiosk.sh"
echo "   (look for SERVER= near the top, default http://n8n.local:8080)"
echo "2. Make sure the Pi's hostname matches what you'll register in"
echo "   the dashboard. Current hostname: $(hostname)"
echo "3. Register this hostname in the dashboard, then reboot:"
echo "     sudo reboot"
echo
echo "Logs: tail -f /var/log/arcom-kiosk.log"