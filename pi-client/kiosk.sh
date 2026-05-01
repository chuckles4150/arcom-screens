#!/usr/bin/env bash
# arcom-screens kiosk client.
# Runs on each Pi 3. Polls the server, runs Chromium fullscreen against
# the configured URL(s), handles rotation, refreshes, and recovers from
# Chromium crashes or unreachable target URLs.
#
# Lives at /home/<user>/arcom-kiosk/kiosk.sh
# Started by .xinitrc on tty1 auto-login

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────
SERVER="${SERVER:-http://n8n.local:8080}"
HOSTNAME="$(hostname)"
HEARTBEAT_INTERVAL=30
WATCHDOG_INTERVAL=10
URL_CHECK_TIMEOUT=8

CHROMIUM_FLAGS=(
  --kiosk
  --start-fullscreen
  --noerrdialogs
  --disable-infobars
  --disable-translate
  --disable-features=TranslateUI
  --no-first-run
  --check-for-update-interval=31536000
  --autoplay-policy=no-user-gesture-required
  --disable-pinch
  --overscroll-history-navigation=0
  --disable-gpu
  --disable-session-crashed-bubble
  --disable-restore-session-state
)

CONFIG_FILE="/tmp/arcom-kiosk-config.json"
LAST_URL_FILE="/tmp/arcom-kiosk-last-url"
SINCE_FILE="/tmp/arcom-kiosk-fallback-since"

log() {
  echo "[$(date '+%H:%M:%S')] $*"
}

# ── Heartbeat ─────────────────────────────────────────────────────
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

# ── Screenshot uploader ──────────────────────────────────────────
screenshot_loop() {
  sleep 30  # let chromium settle on first boot
  while true; do
    local img="/tmp/arcom-kiosk-shot.png"
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

# ── Chromium watchdog ────────────────────────────────────────────
# Checks every WATCHDOG_INTERVAL seconds that Chromium is still alive.
# If it died, sets first_run flag so main loop re-launches it.
chromium_watchdog() {
  while true; do
    sleep $WATCHDOG_INTERVAL
    if ! pgrep -f "chromium.*--kiosk" > /dev/null; then
      log "watchdog: chromium not running, will relaunch"
      touch /tmp/arcom-kiosk-needs-relaunch
    fi
  done
}

# ── Reading config ───────────────────────────────────────────────
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

# ── URL reachability check ───────────────────────────────────────
# Returns 0 if URL responds with anything in the 2xx/3xx range.
# Used to decide whether to load the URL or the fallback page.
url_is_reachable() {
  local url="$1"
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" \
    --max-time $URL_CHECK_TIMEOUT \
    --connect-timeout 5 \
    "$url" 2>/dev/null || echo "000")

  # 2xx and 3xx are good. 4xx/5xx still mean the server responded
  # which means the page will at least render (even if it's an
  # error page it's better than the kiosk going to a fallback).
  if [[ "$status" =~ ^[23] ]]; then
    return 0
  fi
  # 4xx/5xx — let Chromium handle it (might be auth required etc)
  if [[ "$status" =~ ^[45] ]]; then
    return 0
  fi
  return 1
}

build_fallback_url() {
  local target="$1"
  local since
  since=$(cat "$SINCE_FILE" 2>/dev/null || echo "")
  if [[ -z "$since" ]]; then
    since=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "$since" > "$SINCE_FILE"
  fi

  local enc_url enc_since
  enc_url=$(printf '%s' "$target" | jq -sRr @uri)
  enc_since=$(printf '%s' "$since" | jq -sRr @uri)

  echo "$SERVER/fallback.html?hostname=$HOSTNAME&url=$enc_url&since=$enc_since"
}

# ── Chromium control ─────────────────────────────────────────────
launch_chromium() {
  local url="$1"
  log "launching chromium → $url"
  echo "$url" > "$LAST_URL_FILE"
  pkill -f chromium 2>/dev/null || true
  sleep 1

  local geometry
  geometry=$(DISPLAY=:0 xdotool getdisplaygeometry 2>/dev/null || echo "1920 1080")
  local width="${geometry% *}"
  local height="${geometry#* }"
  log "detected screen: ${width}x${height}"

  DISPLAY=:0 chromium "${CHROMIUM_FLAGS[@]}" \
    --window-size="${width},${height}" \
    --window-position=0,0 \
    "$url" >/dev/null 2>&1 &
}

navigate_chromium() {
  local url="$1"
  log "navigating chromium → $url"
  echo "$url" > "$LAST_URL_FILE"
  DISPLAY=:0 xdotool search --onlyvisible --class chromium windowactivate --sync \
    key ctrl+l type --delay 50 "$url" 2>/dev/null
  DISPLAY=:0 xdotool key Return 2>/dev/null
}

show_url_or_fallback() {
  local target="$1"
  local force_relaunch="$2"

  if url_is_reachable "$target"; then
    log "target reachable: $target"
    rm -f "$SINCE_FILE"
    if [[ "$force_relaunch" == "true" ]]; then
      launch_chromium "$target"
    else
      navigate_chromium "$target"
    fi
  else
    local fallback
    fallback=$(build_fallback_url "$target")
    log "target unreachable, showing fallback: $fallback"
    if [[ "$force_relaunch" == "true" ]]; then
      launch_chromium "$fallback"
    else
      navigate_chromium "$fallback"
    fi
  fi
}

# ── Main loop ────────────────────────────────────────────────────
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

    # Force-refresh from the dashboard
    local force_at
    force_at=$(get_config_field '.forceRefreshAt')
    if [[ -n "$force_at" && "$force_at" != "null" && "$force_at" != "$last_force_refresh" ]]; then
      log "force refresh requested"
      last_force_refresh="$force_at"
      first_run=true
    fi

    # Watchdog flagged chromium dead
    if [[ -f /tmp/arcom-kiosk-needs-relaunch ]]; then
      log "watchdog triggered relaunch"
      rm -f /tmp/arcom-kiosk-needs-relaunch
      first_run=true
    fi

    # Get current URL in rotation
    local url
    url=$(get_url "$url_idx")
    if [[ -z "$url" || "$url" == "null" ]]; then
      url_idx=0
      url=$(get_url 0)
    fi

    show_url_or_fallback "$url" "$first_run"
    first_run=false

    # Wait either the per-URL duration or the refresh interval
    local wait_seconds
    if [[ "$count" -gt 1 ]]; then
      wait_seconds=$(get_url_duration "$url_idx")
    else
      local refresh_min
      refresh_min=$(get_config_field '.refresh')
      wait_seconds=$((refresh_min * 60))
    fi

    log "showing URL $((url_idx + 1))/$count for ${wait_seconds}s"

    # Sleep in 5s chunks so we can react to chromium dying mid-wait
    # OR a URL change in the config OR a force-refresh from dashboard
    local elapsed=0
    while [[ $elapsed -lt $wait_seconds ]]; do
      sleep 5
      elapsed=$((elapsed + 5))
      if [[ -f /tmp/arcom-kiosk-needs-relaunch ]]; then
        log "watchdog interrupt during wait"
        break
      fi
      # Check if URL config changed mid-wait
      local current_url
      current_url=$(get_url "$url_idx")
      if [[ "$current_url" != "$url" ]]; then
        log "URL changed mid-wait: $url → $current_url"
        first_run=true
        break
      fi
      # Check if force-refresh was requested mid-wait
      local force_at
      force_at=$(get_config_field '.forceRefreshAt')
      if [[ -n "$force_at" && "$force_at" != "null" && "$force_at" != "$last_force_refresh" ]]; then
        log "force refresh during wait"
        last_force_refresh="$force_at"
        first_run=true
        break
      fi
    done

    # Advance rotation only if we waited the full duration
    if [[ $elapsed -ge $wait_seconds ]]; then
      url_idx=$(( (url_idx + 1) % count ))
    fi
  done
}

# ── Boot ─────────────────────────────────────────────────────────
log "arcom-kiosk starting on $HOSTNAME"
log "server: $SERVER"

# Disable screen blanking and cursor
DISPLAY=:0 xset s off 2>/dev/null || true
DISPLAY=:0 xset -dpms 2>/dev/null || true
DISPLAY=:0 xset s noblank 2>/dev/null || true
DISPLAY=:0 unclutter -idle 1 -root &

# Background loops
heartbeat_loop &
screenshot_loop &
chromium_watchdog &

# Main loop in foreground
main_loop