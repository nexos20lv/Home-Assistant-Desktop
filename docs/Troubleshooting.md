# Troubleshooting

---

## Diagnostics first

Before diving into specific issues, open **Preferences → Advanced → Error Log**. It shows the last 300 runtime log entries with timestamps and severity levels. Most problems leave a trace here.

Click **Export Logs** to save them as a `.txt` file you can attach to a GitHub issue.

---

## Connection problems

### White/blank screen on launch

The app cannot reach your HA URL.

1. Check that Home Assistant is running and accessible from a browser on the same machine.
2. Open Preferences and verify the Local URL (and Remote URL if applicable).
3. If the URL is correct, try clicking the **Reload** option in the right-click context menu.
4. Check the Error Log for `did-fail-load` or `ERR_CONNECTION_REFUSED` entries.

### Status pill stuck on "Offline"

- Confirm the HA URL includes the correct port (`http://192.168.1.5:8123` not `http://192.168.1.5`).
- If you use HTTPS, verify the certificate is valid (self-signed certs may be rejected).
- Check that your firewall allows the app to make outbound connections on that port.
- The 2-minute Smart Connect cooldown may be active — wait and it will re-check.

### App loads Local but should be using Remote (or vice versa)

Smart Connect has a 2-minute cooldown to prevent flapping. Wait for it to expire or save Preferences to force an immediate re-evaluation. If you want to permanently force one URL, use **Use Remote URL** toggle.

### WebSocket keeps reconnecting

If the Error Log shows repeated `HA WebSocket disconnected` / `HA WebSocket error` entries:

- Check that the API token is correct and not expired
- Some reverse proxies (nginx, Traefik) need WebSocket upgrade headers configured — see [HA reverse proxy docs](https://www.home-assistant.io/docs/configuration/remote/)
- Try disabling the remote URL and using only local to isolate the problem

---

## Sensors not updating

### Entities never appear in HA

1. Confirm the token in **Preferences → Sensors → Remote API Access Token** is correct.
2. Generate a new token in HA (Profile → Security → Long-lived access tokens) and update it in Preferences.
3. Check the Error Log for `401 Unauthorized` — this always means a bad token.
4. Make sure the app can reach the HA REST API: open `http://your-ha-url:8123/api/` in a browser — you should see `{"message": "API running."}`.

### Sensors appear but stop updating

- Restart the app.
- Check the report interval in Preferences → Sensors (15-minute interval looks like no updates).
- If Power Saver Mode is on, updates slow down on battery. Plug in or disable it.
- Look for `sensor delivery queue` or `flushSensorQueue` errors in the log.

### Active App / Mic / Camera show nothing (macOS)

macOS requires explicit privacy permissions:

- **Accessibility** (for active app): System Settings → Privacy & Security → Accessibility → enable Home Assistant Desktop
- **Microphone** (for mic sensor): System Settings → Privacy & Security → Microphone → enable Home Assistant Desktop

After granting permissions, restart the app.

### DND sensor always shows `off` (Windows)

The app reads Focus Assist state via PowerShell. On some Windows 11 builds, Focus Assist was replaced by "Do Not Disturb" — the detection method is the same, but the registry path changed. Open an issue if this affects you; include your Windows 11 version.

---

## App closes itself / crashes

### Out of memory crash (older versions)

Versions before 1.0.26 had a memory leak caused by undrained HTTP response bodies in the sensor reporting loop. Upgrade to the latest release to fix this.

### macOS EXC_BREAKPOINT crash (Tahoe beta)

macOS 26 (Tahoe) is an unreleased developer beta. Electron 40 has not been validated against it. This is an upstream compatibility issue — nothing the app can fix until Electron supports the new OS. Stay on macOS 15 Sequoia for stable operation.

---

## Windows-specific

### PowerShell windows flashing on screen

Fixed in v1.0.27. All PowerShell calls now use `windowsHide: true`. Upgrade to the latest release.

### App not found in system tray after startup

The app minimizes to tray rather than the taskbar. Look for the house icon in the notification area (expand the hidden icons chevron). Right-click → Show App.

### "Windows protected your PC" on install

The installer is not code-signed. Click **More info → Run anyway**. The source code is on GitHub and fully auditable.

---

## macOS-specific

### "App is damaged" error

```sh
xattr -d com.apple.quarantine "/Applications/Home Assistant Desktop.app"
```

Run this once in Terminal after dragging the app to Applications.

### TouchID prompt never appears

- The device must have Touch ID or Apple Watch unlock enabled
- Go to System Settings → Privacy & Security → Accessibility and ensure the app is listed and checked

---

## Linux-specific

### App won't launch on Wayland

The app enables Wayland natively via `ozone-platform-hint=auto`. If it still fails, try forcing XWayland as a workaround:

```sh
ELECTRON_OZONE_PLATFORM_HINT=x11 home-assistant-desktop
```

### Tray icon missing (GNOME)

GNOME does not show tray icons by default. Install the **AppIndicator and KStatusNotifierItem Support** extension from [extensions.gnome.org](https://extensions.gnome.org/extension/615/appindicator-support/).

### Sensors not working on Linux

Active App, DND, Mic, and Camera sensors are not available on Linux (no cross-distro API). CPU, RAM, battery, uptime, and status sensors work on all Linux systems.

---

## Resetting the app completely

1. Quit the app via Tray → Quit
2. Delete the user data directory:

| OS | Path |
|---|---|
| Windows | `%APPDATA%\home-assistant-desktop` |
| macOS | `~/Library/Application Support/home-assistant-desktop` |
| Linux | `~/.config/home-assistant-desktop` |

3. Relaunch — the setup wizard appears again.

---

## Filing a bug report

Please include:

- App version (shown at the bottom of the Preferences sidebar)
- OS name and version
- Exported error log (Preferences → Advanced → Export Logs)
- Steps to reproduce
- Expected vs actual behavior

[Open an issue →](https://github.com/nexos20lv/Home-Assistant-Desktop/issues/new)
