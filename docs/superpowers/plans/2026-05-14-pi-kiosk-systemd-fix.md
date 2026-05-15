# Pi Kiosk systemd Launch — Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the systemd-launched kiosk on Pi 3B+ / Pi OS Lite so it starts reliably, auto-recovers from X crashes, and stops crash-looping on SIGHUP.

**Architecture:** Two files change: `pi-client/arcom-kiosk.service` (drop `PAMName=login`, add full TTY block + `Conflicts=getty@tty1`, pass `vt1 -keeptty` to Xorg, switch to `graphical.target`) and `pi-client/install.sh` (disable `getty@tty1.service`, enable linger so `/run/user/$UID` exists without PAM, set graphical default). No test framework is appropriate here — the verification is a documented manual run-recipe executed on the live Pi via SSH.

**Tech Stack:** systemd unit files, Xorg/startx, bash, Pi OS Lite (Debian 13 Trixie), Pi 3B+.

**Related spec:** [`docs/superpowers/specs/2026-05-14-pi-kiosk-systemd-fix-design.md`](../specs/2026-05-14-pi-kiosk-systemd-fix-design.md)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `pi-client/arcom-kiosk.service` | Modify | systemd unit definition for the kiosk |
| `pi-client/install.sh` | Modify | One-time-per-Pi setup script |
| `pi-client/kiosk.sh` | Unchanged | Inner kiosk runtime — works as-is |

---

## Task 1: Rewrite `pi-client/arcom-kiosk.service`

**Files:**
- Modify: [`pi-client/arcom-kiosk.service`](../../../pi-client/arcom-kiosk.service)

- [ ] **Step 1: Replace the entire file with the new unit definition**

Overwrite [`pi-client/arcom-kiosk.service`](../../../pi-client/arcom-kiosk.service) with the following content. The `KIOSK_USER_PLACEHOLDER` and `XDG_RUNTIME_DIR=/run/user/1000` substitutions are handled by `install.sh` — do not pre-substitute.

```ini
[Unit]
Description=Arcom Kiosk Display
After=network-online.target systemd-user-sessions.service getty@tty1.service
Wants=network-online.target
# We own tty1; getty must not be running while we are. The Conflicts=
# directive makes systemd stop getty@tty1 if it's somehow up when we
# start, and prevents it from starting while we're running.
Conflicts=getty@tty1.service

[Service]
Type=simple
User=KIOSK_USER_PLACEHOLDER
WorkingDirectory=/home/KIOSK_USER_PLACEHOLDER

# tty: needed for /dev/tty1 ioctls Xorg performs during VT setup.
# video, render: needed for /dev/dri/* (KMS / DRM) on modern kernels.
# input: needed for evdev access to keyboard/mouse without root.
SupplementaryGroups=tty video input render

# Hand the kiosk an explicit TTY so Xorg's parse_vt_settings() can find
# a free VT, and so we own /dev/tty1 unambiguously (the Conflicts=
# directive above stops getty@tty1 from fighting us for it).
# tty-fail (not tty) makes the service refuse to start if the TTY is
# still held by something else — fast loud failure beats silent SIGHUP.
TTYPath=/dev/tty1
TTYReset=yes
TTYVHangup=yes
TTYVTDisallocate=yes
StandardInput=tty-fail
UnsetEnvironment=TERM

# install.sh sed-substitutes /run/user/1000 with the actual UID for the
# kiosk user. loginctl enable-linger (also in install.sh) creates the
# directory at boot — we used to get this for free from PAMName=login.
Environment=XDG_RUNTIME_DIR=/run/user/1000
Environment=DISPLAY=:0
Environment=SERVER=http://n8n.local:8080

# startx launches an X session and runs kiosk.sh as the user's xinit-like
# entrypoint. The flags after `--` go to Xorg itself:
#   vt1       — use the VT systemd handed us, don't allocate a new one
#   -keeptty  — don't switch VTs at startup (would break our TTY binding)
#   -nocursor — hide the mouse pointer
ExecStart=/usr/bin/startx /home/KIOSK_USER_PLACEHOLDER/arcom-kiosk/kiosk.sh -- vt1 -keeptty -nocursor

# Reliability: any non-zero exit (Chromium crash, X falling over, kiosk.sh
# bug) is restarted with a 5s backoff. Three failures in 60s pauses for
# 30s before retrying again so we don't burn flash with a tight loop.
Restart=always
RestartSec=5
StartLimitIntervalSec=60
StartLimitBurst=3

# Logging — appended via systemd-journald, plus a plain text log for
# tail-friendliness. install.sh creates the file with the right ownership.
StandardOutput=append:/var/log/arcom-kiosk.log
StandardError=append:/var/log/arcom-kiosk.log

# A clean stop kills the whole tree (chromium, scrot loops, watchdog).
KillMode=mixed
TimeoutStopSec=10

[Install]
WantedBy=graphical.target
```

- [ ] **Step 2: Verify the file parses as valid systemd syntax**

This is a local-only check; the Pi will do the real validation when systemd loads it. We're checking for typos.

Run from the repo root:

```sh
git diff pi-client/arcom-kiosk.service
```

Expected: a diff showing `PAMName=login` removed, `Conflicts=getty@tty1.service` added, `TTYPath=/dev/tty1` block added, `WorkingDirectory=` added, `SupplementaryGroups=` added, `ExecStart` now ends with `-- vt1 -keeptty -nocursor`, and `WantedBy=` changed to `graphical.target`. No leftover `PAMName` lines.

- [ ] **Step 3: Commit**

```sh
git add pi-client/arcom-kiosk.service
git commit -m "fix(pi-client): rewrite kiosk unit to fix VT permission + SIGHUP loop

Drops PAMName=login (source of session-teardown SIGHUP), adds
Conflicts=getty@tty1.service (the missing piece — getty was racing
us for tty1), adds the full TTY block so Xorg can find a VT, and
passes vt1 -keeptty to Xorg via startx so it doesn't break the
systemd-supplied TTY binding by switching VTs mid-startup.

Also switches WantedBy from multi-user.target to graphical.target,
adds WorkingDirectory for xinit's .Xauthority, and adds render to
the supplementary groups for DRI device access."
```

---

## Task 2: Update `pi-client/install.sh`

**Files:**
- Modify: [`pi-client/install.sh`](../../../pi-client/install.sh)

This task adds three behaviors and renumbers the step counter. Each sub-step is a single targeted edit so the diff stays readable.

- [ ] **Step 1: Renumber the progress counter from 7 to 9**

Find every `[N/7]` echo line and update to `[N/9]`. The two new steps will be added in Step 3 and Step 4 of this task. Mapping:

| Old | New |
|---|---|
| `[1/7]` (packages) | `[1/9]` |
| `[2/7]` (Xwrapper) | `[2/9]` |
| `[3/7]` (kiosk dir) | `[3/9]` |
| `[4/7]` (legacy autologin) | `[4/9]` |
| `[5/7]` (install service) | `[6/9]` (renumber to leave room for new step 5) |
| `[6/7]` (logging) | `[7/9]` |
| `[7/7]` (done) | `[9/9]` |

New `[5/9]` and `[8/9]` are added in Steps 3 and 4 below.

Apply edits to [`pi-client/install.sh`](../../../pi-client/install.sh).

- [ ] **Step 2: Strengthen the legacy-autologin removal to fully disable getty@tty1**

In the existing section currently labeled `[4/7]` ("Removing legacy auto-login..."), replace the body so it disables the underlying getty service, not just the autologin override.

Find:

```sh
# 4. Disable any existing tty1 auto-login (we replace it with the systemd service)
echo "[4/7] Removing legacy auto-login..."
rm -f /etc/systemd/system/getty@tty1.service.d/override.conf
rm -f "$KIOSK_HOME/.bash_profile"
rm -f "$KIOSK_HOME/.xinitrc"
systemctl daemon-reload
```

Replace with:

```sh
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
```

The `|| true` guards against a fresh Pi where `getty@tty1.service` was never enabled — `disable` returns non-zero in that case and `set -e` would abort.

- [ ] **Step 3: Add a new step to enable linger for the kiosk user**

This step replaces the `/run/user/$UID` creation we used to get for free from `PAMName=login`. Add it immediately after the existing `[4/9]` block (the one we just edited) and before the `[5/9]` step.

Insert:

```sh
# 5. Enable linger so /run/user/$UID is created at boot and persists
#    even though no human ever logs in. Replaces what PAMName=login
#    used to give us.
echo "[5/9] Enabling user linger for $KIOSK_USER..."
loginctl enable-linger "$KIOSK_USER"
```

- [ ] **Step 4: Add a new step to set the default boot target to graphical**

Add this step immediately after the systemd service install (the existing `[6/9]` block — was `[5/7]` pre-renumber) and before the logging step.

Insert:

```sh
# 8. Boot directly into graphical mode. The kiosk unit's
#    WantedBy=graphical.target means this is where it gets pulled in.
echo "[8/9] Setting default systemd target to graphical..."
systemctl set-default graphical.target
```

- [ ] **Step 5: Verify the diff**

Run from the repo root:

```sh
git diff pi-client/install.sh
```

Expected: progress counters updated `[N/7]` → `[N/9]`, getty@tty1 disable line added, `loginctl enable-linger` step added, `systemctl set-default graphical.target` step added. No other behavior changed.

- [ ] **Step 6: Verify shell syntax**

If `bash` is available locally:

```sh
bash -n pi-client/install.sh
```

Expected: no output (exit code 0). If `bash` is not on Windows PATH, skip — the Pi will catch syntax errors on first run.

- [ ] **Step 7: Commit**

```sh
git add pi-client/install.sh
git commit -m "fix(pi-client): disable getty@tty1, enable linger, default to graphical target

Three changes that pair with the kiosk unit rewrite:

- systemctl disable --now getty@tty1.service: the missing piece that
  was letting getty race the kiosk for tty1 on boot.
- loginctl enable-linger: creates /run/user/\$UID at boot without
  needing PAM (which we dropped from the unit).
- systemctl set-default graphical.target: the kiosk unit is now
  WantedBy=graphical.target, so this is where it gets pulled in."
```

---

## Task 3: Deploy and verify on the live Pi

**Files:** None modified — this is a deploy-and-test pass.

This task requires SSH access to `pi-attendance` (host `pi-attendance`, user `pi-attendance`, key auth). The user will provide it before this task runs.

- [ ] **Step 1: Confirm SSH access works**

Run from your dev machine:

```sh
ssh pi-attendance@pi-attendance "uname -a && id"
```

Expected: kernel string ending in `... aarch64 GNU/Linux` (or `armv7l` on older Pi OS), and an `id` line including `groups=...` (note the current groups for comparison after install).

- [ ] **Step 2: Pull the new branch onto the Pi**

```sh
ssh pi-attendance@pi-attendance "cd ~/arcom-screens && git fetch && git checkout redesign/kiosks && git pull"
```

Expected: branch switched to `redesign/kiosks`, HEAD matches the two commits from Tasks 1 and 2.

If `~/arcom-screens` does not exist on the Pi, clone it first:

```sh
ssh pi-attendance@pi-attendance "git clone https://github.com/chuckles4150/arcom-screens.git ~/arcom-screens && cd ~/arcom-screens && git checkout redesign/kiosks"
```

- [ ] **Step 3: Stop any currently-running kiosk service and run the installer**

```sh
ssh pi-attendance@pi-attendance "sudo systemctl stop arcom-kiosk 2>/dev/null; sudo ~/arcom-screens/pi-client/install.sh"
```

Expected: installer runs through steps `[1/9]` through `[9/9]` without errors. Final "Next steps" block is printed.

- [ ] **Step 4: Verify the installed unit file looks correct**

```sh
ssh pi-attendance@pi-attendance "sudo cat /etc/systemd/system/arcom-kiosk.service"
```

Expected: file contents match `pi-client/arcom-kiosk.service` from the repo, but with `KIOSK_USER_PLACEHOLDER` replaced by `pi-attendance` and `/run/user/1000` left as `/run/user/1000` (uid 1000 is correct for the default Pi user).

- [ ] **Step 5: Confirm getty@tty1 is disabled and the kiosk user has the right groups**

```sh
ssh pi-attendance@pi-attendance "systemctl is-enabled getty@tty1.service; id pi-attendance"
```

Expected: `getty@tty1` reports `disabled` (or `masked`). `id` output includes at minimum `tty`, `video`, `input`, `render` in `groups=` — these come from `SupplementaryGroups` at service runtime, not from `id`, so the more authoritative check is the next step.

- [ ] **Step 6: Start the kiosk and watch the journal**

```sh
ssh pi-attendance@pi-attendance "sudo systemctl start arcom-kiosk && sleep 15 && sudo journalctl -u arcom-kiosk -b --no-pager | tail -50"
```

Expected:
- No `parse_vt_settings: Cannot open /dev/tty0` lines.
- No `signal=HUP` lines.
- `Started Arcom Kiosk Display.` near the top.
- Kiosk script log lines: `arcom-kiosk starting on pi-attendance`, `waiting for first config from http://n8n.local:8080...`, `config received`, `launching chromium → <url>`.

**Physically check the screen attached to the Pi** — it should be showing the dashboard URL fullscreen with no cursor.

- [ ] **Step 7: Test crash recovery**

```sh
ssh pi-attendance@pi-attendance "sudo pkill Xorg"
```

Then wait 30 seconds and check status:

```sh
ssh pi-attendance@pi-attendance "sleep 30 && sudo systemctl status arcom-kiosk --no-pager && sudo journalctl -u arcom-kiosk -b --no-pager | tail -20"
```

Expected: service status `active (running)`. Journal shows the original start, a "Main process exited" line, a "Stopped" line, a "Started" line, and the kiosk re-launching. **Physically check the screen** — it should be back to the dashboard URL.

- [ ] **Step 8: Test reboot recovery**

```sh
ssh pi-attendance@pi-attendance "sudo reboot"
```

Wait ~60 seconds, then:

```sh
ssh pi-attendance@pi-attendance "sudo systemctl status arcom-kiosk --no-pager"
```

Expected: service is `active (running)`. **Physically check the screen** — Pi booted directly into the kiosk with no visible login prompt at any point.

- [ ] **Step 9: Confirm no SIGHUPs occurred during the full test**

```sh
ssh pi-attendance@pi-attendance "sudo journalctl -u arcom-kiosk -b --no-pager | grep -i -E 'signal=HUP|parse_vt_settings|Permission denied' || echo 'CLEAN: no failure-mode lines'"
```

Expected: `CLEAN: no failure-mode lines`.

- [ ] **Step 10: Write up what was wrong and what changed**

After verification passes, summarize for the user in chat (no separate file):
- The two bugs (SIGHUP loop from getty@tty1 race + Xorg VT permission)
- The fix in one paragraph
- Confirmation of the three test outcomes (start, crash-recover, reboot)
- A note that `pi-printroom` can now be migrated by running the same installer

No commit needed for this step — it's a chat-only summary.

---

## Verification Summary

After all three tasks complete:

- [ ] `pi-client/arcom-kiosk.service` rewritten and committed
- [ ] `pi-client/install.sh` updated and committed
- [ ] Service starts cleanly on `pi-attendance`
- [ ] `pkill Xorg` → service auto-recovers within 30s
- [ ] Reboot → Pi comes up directly in kiosk mode
- [ ] No SIGHUP, no VT permission errors in journal
- [ ] All commits stay on `redesign/kiosks` (not merged to `main`)
