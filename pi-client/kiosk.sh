#!/usr/bin/env bash
# arcom-screens kiosk client.
# Runs on each Pi 3. Polls the server, runs Chromium fullscreen against
# the configured URL(s), handles rotation, and reloads on the configured
# refresh interval.
#
# Lives at /home/pi/arcom-kiosk/kiosk.sh
# Started by systemd: arcom-kiosk.service

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────
SERVER="${SERVER:-http://n8n.local:8080}"
HOSTNAME="$(hostname)"
HEARTBEAT_INTERVAL=30
CHROMIUM_FLAGS=(
  --kiosk
  --noerrdialogs
  --disable-infobars
  --disable-translate
  --disable-features=TranslateUI
  --no-first-run
  --check-for-update-interval=31536000
  --autoplay-policy=no-user-gesture-required
  --disable-pinch
  --overscroll-history-navigation=0
)

CONFIG_FILE="/tmp/arcom-kiosk-config.json"
LAST_URL_FILE="/tmp/arcom-kiosk-last-url"
STATE_FILE="/tmp/arcom-kiosk-state"

log() {
  echo "[$(date '+%H:%M:%S')] $*"
}

# ── Heartbeat ─────────────────────────────────────────────────────
# Phones home every HEARTBEAT_INTERVAL with current URL, gets back
# the screen's full config. Writes config to $CONFIG_FILE so the
# main loop can read it.
heartbeat_loop() {
  while true; do
    local current_url
    current_url=$(cat "$LAST_URL_FILE" 2>/dev/null || echo "")

    local response
    response=$(curl -s -X POST "$SERVER/api/pi/heartbeat" \
      -H "Content-Type: application/json" \
      -d "{\"hostname\":\"$HOSTNAME\",\"currentUrl\":\"$current_url\"}" \
      --max-time 10 || echo "")

    if [[ -n "$response" ]]; then
      echo "$response" > "$CONFIG_FILE.tmp"
      mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
    fi

    sleep $HEARTBEAT_INTERVAL
  done
}

# ── Screenshot uploader ───────────────────────────────────────────
# Captures the framebuffer with scrot and uploads.
# Runs every 60s — slower than heartbeat to keep load light.
screenshot_loop() {
  sleep 30  # let chromium settle on first boot
  while true; do
    local img="/tmp/arcom-kiosk-shot.png"
    # scrot needs $DISPLAY to find the X server
    DISPLAY=:0 scrot --silent --quality 60 "$img" 2>/dev/null || {
      log "scrot failed (no display yet?)"
      sleep 60
      continue
    }

    curl -s -X POST "$SERVER/api/pi/screenshot" \
      -F "hostname=$HOSTNAME" \
      -F "screenshot=@$img" \
      --max-time 30 > /dev/null || log "screenshot upload failed"

    rm -f "$img"
    sleep 60
  done
}

# ── Reading config ────────────────────────────────────────────────
# jq pulls fields out of the JSON the server returns.
get_config_field() {
  local field="$1"
  jq -r "$field" "$CONFIG_FILE" 2>/dev/null || echo ""
}

get_url_count() {
  jq -r '.urls | length' "$CONFIG_FILE" 2>/dev/null || echo "0"
}

get_url() {
  local i="$1"
  jq -r ".urls[$i].url" "$CONFIG_FILE" 2>/dev/null
}

get_url_duration() {
  local i="$1"
  jq -r ".urls[$i].duration" "$CONFIG_FILE" 2>/dev/null || echo "60"
}

# ── Chromium control ─────────────────────────────────────────────
launch_chromium() {
  local url="$1"
  log "launching chromium → $url"
  echo "$url" > "$LAST_URL_FILE"
  pkill -f chromium 2>/dev/null || true
  sleep 1
  DISPLAY=:0 chromium "${CHROMIUM_FLAGS[@]}" "$url" &
}

navigate_chromium() {
  local url="$1"
  log "navigating chromium → $url"
  echo "$url" > "$LAST_URL_FILE"
  # xdotool switches the URL in the existing tab — faster than relaunching
  DISPLAY=:0 xdotool search --onlyvisible --class chromium windowactivate --sync \
    key ctrl+l type --delay 50 "$url" 2>/dev/null
  DISPLAY=:0 xdotool key Return 2>/dev/null
}

# ── Main loop ─────────────────────────────────────────────────────
# Wait for first heartbeat to populate config, then loop forever:
# - For single URL: launch chromium, sleep until refresh interval, reload
# - For rotation: cycle URLs with their per-URL durations, reload page on refresh interval
main_loop() {
  log "waiting for first config from $SERVER..."
  while [[ ! -f "$CONFIG_FILE" ]]; do
    sleep 2
  done
  log "config received"

  local url_idx=0
  local last_force_refresh=""
  local first_run=true

  while true; do
    local count
    count=$(get_url_count)
    if [[ "$count" -lt 1 ]]; then
      log "no URLs configured, waiting..."
      sleep 10
      continue
    fi

    # Handle force-refresh from the dashboard
    local force_at
    force_at=$(get_config_field '.forceRefreshAt')
    if [[ -n "$force_at" && "$force_at" != "null" && "$force_at" != "$last_force_refresh" ]]; then
      log "force refresh requested"
      last_force_refresh="$force_at"
      first_run=true
    fi

    # Get the current URL in the rotation
    local url
    url=$(get_url "$url_idx")
    if [[ -z "$url" || "$url" == "null" ]]; then
      url_idx=0
      url=$(get_url 0)
    fi

    if [[ "$first_run" == "true" ]]; then
      launch_chromium "$url"
      first_run=false
    else
      navigate_chromium "$url"
    fi

    # Wait either the per-URL duration (if rotating) or the refresh interval
    local wait_seconds
    if [[ "$count" -gt 1 ]]; then
      wait_seconds=$(get_url_duration "$url_idx")
    else
      local refresh_min
      refresh_min=$(get_config_field '.refresh')
      wait_seconds=$((refresh_min * 60))
    fi

    log "showing URL $((url_idx + 1))/$count for ${wait_seconds}s"
    sleep "$wait_seconds"

    # Advance rotation
    url_idx=$(( (url_idx + 1) % count ))
  done
}

# ── Boot ──────────────────────────────────────────────────────────
log "arcom-kiosk starting on $HOSTNAME"
log "server: $SERVER"

# Disable screen blanking and cursor
DISPLAY=:0 xset s off 2>/dev/null || true
DISPLAY=:0 xset -dpms 2>/dev/null || true
DISPLAY=:0 xset s noblank 2>/dev/null || true
DISPLAY=:0 unclutter -idle 1 -root &

# Run heartbeat and screenshot loops in background
heartbeat_loop &
screenshot_loop &

# Main loop runs in foreground (systemd watches this)
main_loop
