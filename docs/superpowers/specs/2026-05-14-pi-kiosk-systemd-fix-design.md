# Pi Kiosk systemd Launch — Bug Fix Design

**Date:** 2026-05-14
**Branch:** `redesign/kiosks`
**Affects:** `pi-client/arcom-kiosk.service`, `pi-client/install.sh`

## Problem

The systemd-launched kiosk introduced in commit `36d74ec` ("Phase 2 — Pi
instrumentation + systemd launch") fails on a fresh deploy to a Pi 3B+
running Pi OS Lite (Debian 13 Trixie, kernel 6.12.75).

Two failure modes observed:

1. **Initial deploy:** Xorg exits immediately with
   `parse_vt_settings: Cannot open /dev/tty0 (Permission denied)`.
2. **After adding `TTYPath=/dev/tty1`, `TTYReset=yes`, `TTYVHangup=yes`,
   `StandardInput=tty`, `SupplementaryGroups=tty video input`:** the
   service is killed by `signal=HUP` shortly after start instead of
   exiting cleanly. Crash-loops indefinitely.

## Root Causes

### Cause 1 — Xorg cannot find a free VT

Xorg's `parse_vt_settings()` opens `/dev/tty0` to discover free virtual
terminals. With no controlling TTY assigned to the service, the open
fails. `Xwrapper.config` (`allowed_users=anybody`, `needs_root_rights=yes`)
permits the suid-wrapped Xorg binary, but the wrapper still needs the
invoking process to have a TTY relationship for VT allocation.

Adding `TTYPath=/dev/tty1` gives Xorg the TTY, but Xorg by default tries
to switch to its own VT after binding to one. Without `-keeptty` on the
Xorg command line, the TTY relationship systemd set up is broken
mid-startup.

### Cause 2 — getty@tty1 is still active and triggers SIGHUP

The current `install.sh` removes the autologin override at
`/etc/systemd/system/getty@tty1.service.d/override.conf` but does **not**
disable the underlying `getty@tty1.service`. So when the kiosk unit takes
ownership of `/dev/tty1` and Xorg calls `vhangup()`, the running getty
receives SIGHUP — and because both services are bound to the same TTY,
the HUP propagates back to the kiosk service. systemd records this as
`signal=HUP` and treats it as a failure.

### Cause 3 (latent) — PAMName=login session teardown can re-hangup

`PAMName=login` runs the full interactive-login PAM stack
(`pam_systemd`, `pam_loginuid`, `pam_systemd_home`). On service stop it
performs another `vhangup()` on the TTY during session teardown. With the
TTY conflict above this is the secondary HUP path. PAM is also the
reason `/run/user/$UID` gets created — but that can be replaced by
`loginctl enable-linger`, which is more appropriate for a long-lived
unattended service.

## Fix

### `pi-client/arcom-kiosk.service`

Belt-and-suspenders changes. Each one addresses a specific cause above.

- **Remove** `PAMName=login`.
- **Add** `Conflicts=getty@tty1.service` and `After=getty@tty1.service`
  so the two units can never coexist on the same TTY.
- **Add** the full TTY block:

  ```ini
  TTYPath=/dev/tty1
  TTYReset=yes
  TTYVHangup=yes
  TTYVTDisallocate=yes
  StandardInput=tty-fail
  UnsetEnvironment=TERM
  ```

  `tty-fail` (rather than `tty`) means the service refuses to start if
  the TTY is held by something else — fast, loud failure beats silent
  HUP.
- **Add** `WorkingDirectory=/home/KIOSK_USER_PLACEHOLDER`. xinit needs a
  writable HOME for `.Xauthority`.
- **Keep** `SupplementaryGroups=tty video input` and add `render` for
  DRI device access on modern kernels.
- **Change** `ExecStart` so the flags after `--` are passed to Xorg:

  ```ini
  ExecStart=/usr/bin/startx /home/KIOSK_USER_PLACEHOLDER/arcom-kiosk/kiosk.sh -- :0 vt1 -keeptty -nocursor
  ```

  `:0` pins the display number explicitly (without it, startx auto-bumps
  to `:1` if a stale `/tmp/.X0-lock` from a previous run exists, but
  `kiosk.sh` hardcodes `DISPLAY=:0` so Chromium would then fail to
  connect). `vt1` tells Xorg which VT to use; `-keeptty` stops it from
  doing an extra VT switch that breaks the systemd-supplied TTY binding.
- **Add** `ExecStartPre=+/bin/rm -f /tmp/.X0-lock /tmp/.X11-unix/X0` so
  stale X locks from a previous Xorg run are cleared before each start.
  Required for `pkill Xorg`-style crash recovery within the same boot.
  The `+` prefix runs the rm as root (the lock files are owned by Xorg-
  as-root via Xwrapper's `needs_root_rights=yes`).
- **Change** `WantedBy=multi-user.target` → `WantedBy=graphical.target`.

Restart policy (`Restart=always`, 5s backoff, 3-burst-in-60s limit) is
already correct and is the whole point of the systemd launch — leave it
alone.

### `pi-client/install.sh`

- `systemctl disable --now getty@tty1.service` (the missing piece).
- `loginctl enable-linger "$KIOSK_USER"` so `/run/user/$UID` is created
  at boot without PAM.
- `systemctl set-default graphical.target`.
- Continue to write `Xwrapper.config` (`allowed_users=anybody`,
  `needs_root_rights=yes`) — already correct, no change.
- Continue to substitute `KIOSK_USER_PLACEHOLDER` and the
  `XDG_RUNTIME_DIR` UID — the new `WorkingDirectory` line also uses
  `KIOSK_USER_PLACEHOLDER` so the existing `sed` covers it.

### `pi-client/kiosk.sh`

No functional changes required. The script is invoked by startx and
inherits a proper DISPLAY/XAUTHORITY from xinit, which is exactly what
it expects.

## Verification

Run on the live Pi (`pi-attendance`) after install:

1. `sudo systemctl start arcom-kiosk` — screen shows the dashboard URL
   within ~15 seconds. No HUP, no permission errors in
   `journalctl -u arcom-kiosk`.
2. `sudo pkill Xorg` — service exits non-zero, systemd restarts within
   5 seconds, screen recovers within 30 seconds.
3. `sudo reboot` — Pi comes up directly into the kiosk, no manual
   intervention.
4. `journalctl -u arcom-kiosk -b` shows clean starts only (no
   `signal=HUP` lines).

## Non-Goals

- Migrating `pi-printroom` is the user's responsibility once this works
  on `pi-attendance`. The fix must be portable (no hard-coded hostnames)
  but deployment is out of scope.
- Wayland / cage / weston — Pi 3 GPU support for Wayland on Pi OS Lite
  is not worth the risk for a working Xorg setup.
- Merging to `main` — stays on `redesign/kiosks`.

## Rollback

If the new unit misbehaves on `pi-attendance`:

```sh
sudo systemctl stop arcom-kiosk
sudo systemctl enable --now getty@tty1.service
sudo systemctl set-default multi-user.target
git -C ~/arcom-screens checkout <previous commit> -- pi-client/
sudo ~/arcom-screens/pi-client/install.sh
```

No data loss risk — kiosk state is ephemeral and rebuilt from the
dashboard on next heartbeat.
