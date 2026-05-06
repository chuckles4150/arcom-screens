#!/usr/bin/env bash
# arcom-screens kiosk client.
# Runs on each Pi 3. Polls the server, runs Chromium fullscreen against
# the configured URL(s), handles rotation, refreshes, and recovers from
# Chromium crashes or unreachable target URLs.
#
# Lives at /home/<user>/arcom-kiosk/kiosk.sh
# Started by arcom-kiosk.service (systemd) via /usr/bin/startx

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────
SERVER="${SERVER:-http://n8n.local:8080}"
HOSTNAME="$(hostname)"
HEARTBEAT_INTERVAL=30
WATCHDOG_INTERVAL=10
URL_CHECK_TIMEOUT=8

# Network interface to read RX/TX bytes from. Pi 3 wired = eth0, wifi = wlan0.
# Auto-detect: prefer the first non-loopback interface with carrier up.
NET_IFACE_FILE="/tmp/arcom-kiosk-net-iface"
LAG_FILE="/tmp/arcom-kiosk-last-lag-ms"

# Tracks epoch seconds of the previous heartbeat — used to ask each log
# source for "lines since then". On first run, falls back to (now - 60s).
LAST_HB_FILE="/tmp/arcom-kiosk-last-hb"

# Per-heartbeat caps so a flooded log source can't blow past the request body.
LOG_CAP_JOURNAL=30
LOG_CAP_DMESG=20
LOG_CAP_SYSLOG=30

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

# ── Metric collection ────────────────────────────────────────────
# All read from /proc — cheap, no external deps. Returns a JSON snippet
# the heartbeat loop pastes into the request body. Bandwidth fields are
# CUMULATIVE bytes; the server computes deltas between successive samples.
detect_net_iface() {
  if [[ -s "$NET_IFACE_FILE" ]]; then
    cat "$NET_IFACE_FILE"
    return
  fi
  local iface
  for iface in eth0 wlan0; do
    if [[ -d "/sys/class/net/$iface" ]] && \
       [[ "$(cat "/sys/class/net/$iface/operstate" 2>/dev/null)" == "up" ]]; then
      echo "$iface" > "$NET_IFACE_FILE"
      echo "$iface"
      return
    fi
  done
  # Fallback: first non-loopback up interface.
  for iface in /sys/class/net/*; do
    local name
    name=$(basename "$iface")
    [[ "$name" == "lo" ]] && continue
    if [[ "$(cat "$iface/operstate" 2>/dev/null)" == "up" ]]; then
      echo "$name" > "$NET_IFACE_FILE"
      echo "$name"
      return
    fi
  done
  echo "lo"
}

collect_metrics() {
  local uptime_sec
  uptime_sec=$(awk '{print int($1)}' /proc/uptime 2>/dev/null || echo 0)

  local iface rx_bytes tx_bytes
  iface=$(detect_net_iface)
  rx_bytes=$(cat "/sys/class/net/$iface/statistics/rx_bytes" 2>/dev/null || echo 0)
  tx_bytes=$(cat "/sys/class/net/$iface/statistics/tx_bytes" 2>/dev/null || echo 0)

  local load1
  load1=$(awk '{print $1}' /proc/loadavg 2>/dev/null || echo 0)

  local mem_total_kb mem_avail_kb
  mem_total_kb=$(awk '/^MemTotal:/{print $2}' /proc/meminfo 2>/dev/null || echo 0)
  mem_avail_kb=$(awk '/^MemAvailable:/{print $2}' /proc/meminfo 2>/dev/null || echo 0)
  local mem_total_mb=$(( mem_total_kb / 1024 ))
  local mem_used_mb=$(( (mem_total_kb - mem_avail_kb) / 1024 ))

  local last_lag_ms
  last_lag_ms=$(cat "$LAG_FILE" 2>/dev/null || echo 0)

  jq -n \
    --argjson uptime "$uptime_sec" \
    --argjson rx "$rx_bytes" \
    --argjson tx "$tx_bytes" \
    --arg     load "$load1" \
    --argjson memUsed "$mem_used_mb" \
    --argjson memTotal "$mem_total_mb" \
    --argjson lag "$last_lag_ms" \
    '{
       systemUptimeSec: $uptime,
       bandwidthRxBytes: $rx,
       bandwidthTxBytes: $tx,
       loadAvg1m: ($load | tonumber),
       memUsedMb: $memUsed,
       memTotalMb: $memTotal,
       lastLagMs: $lag
     }'
}

# ── Log collection ───────────────────────────────────────────────
# Pulls fresh lines from journal / dmesg / syslog since the previous
# heartbeat. Each source is capped at a per-heartbeat line limit so a
# chatty source can't blow past the request body size. The server's
# ring buffer trims older lines anyway.
collect_logs() {
  local since_epoch
  since_epoch=$(cat "$LAST_HB_FILE" 2>/dev/null || true)
  if [[ -z "$since_epoch" || ! "$since_epoch" =~ ^[0-9]+$ ]]; then
    since_epoch=$(( $(date +%s) - 60 ))
  fi

  local journal dmesg syslog

  # Kiosk service journal — tagged + iso timestamps.
  journal=$(journalctl -u arcom-kiosk --since="@$since_epoch" --no-pager \
    -o short-iso --no-hostname 2>/dev/null \
    | tail -n "$LOG_CAP_JOURNAL" \
    | jq -Rsc 'split("\n") | map(select(length > 0))' \
    || echo "[]")

  # Kernel ring buffer.
  dmesg=$(dmesg --since="30 sec ago" --time-format=iso --no-pager 2>/dev/null \
    | tail -n "$LOG_CAP_DMESG" \
    | jq -Rsc 'split("\n") | map(select(length > 0))' \
    || echo "[]")

  # Syslog — tail-then-filter by epoch. Syslog timestamps use the
  # current year implicitly so we add it via `date -d` for parsing.
  if [[ -r /var/log/syslog ]]; then
    syslog=$(awk -v cutoff="$since_epoch" '
      {
        ts = $1 " " $2 " " $3
        cmd = "date -d \"" ts "\" +%s 2>/dev/null"
        cmd | getline epoch
        close(cmd)
        if (epoch >= cutoff) print
      }' /var/log/syslog 2>/dev/null \
      | tail -n "$LOG_CAP_SYSLOG" \
      | jq -Rsc 'split("\n") | map(select(length > 0))' \
      || echo "[]")
  else
    syslog="[]"
  fi

  jq -n \
    --argjson j "$journal" \
    --argjson d "$dmesg" \
    --argjson s "$syslog" \
    '{journal: $j, dmesg: $d, syslog: $s}'
}

# ── Heartbeat ─────────────────────────────────────────────────────
heartbeat_loop() {
  while true; do
    local current_url metrics logs body t0 t1 lag_ms hb_now
    current_url=$(cat "$LAST_URL_FILE" 2>/dev/null || echo "")
    metrics=$(collect_metrics)
    logs=$(collect_logs)

    body=$(jq -n \
      --arg hostname "$HOSTNAME" \
      --arg currentUrl "$current_url" \
      --argjson metrics "$metrics" \
      --argjson logs "$logs" \
      '{hostname: $hostname, currentUrl: $currentUrl, metrics: $metrics, logs: $logs}')

    # Stash heartbeat epoch BEFORE the request so the next collect_logs
    # picks up only lines emitted after this point. Tiny risk of missing
    # a line written during the curl, but cheap to accept.
    hb_now=$(date +%s)
    echo "$hb_now" > "$LAST_HB_FILE"

    # Round-trip lag: report this cycle's RTT in the NEXT heartbeat's
    # metrics block (one cycle of staleness is fine — saves an extra
    # request just to measure it).
    t0=$(date +%s%3N)
    local response
    response=$(curl -s -X POST "$SERVER/api/pi/heartbeat" \
      -H "Content-Type: application/json" \
      -d "$body" \
      --max-time 10 || echo "")
    t1=$(date +%s%3N)
    lag_ms=$(( t1 - t0 ))
    # Cap at a sane max — if curl timed out the lag is meaningless noise.
    if [[ $lag_ms -gt 0 && $lag_ms -lt 30000 ]]; then
      echo "$lag_ms" > "$LAG_FILE"
    fi

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