# Changelog

All notable changes are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.30] — 2026-05-20

### Fixed
- **Linux OOM / whole-system RAM fill** — `ozone-platform-hint=auto` was applied unconditionally on Linux, including on X11 sessions (Cinnamon, GNOME-X, KDE-X). On X11, Chromium probes both the Wayland and X11 backends and accumulates GPU framebuffer memory across the GPU process lifetime — root cause of the 31 GB fill reported in [issue #5](https://github.com/nexos20lv/Home-Assistant-Desktop/issues/5). Fix: detect `WAYLAND_DISPLAY` at startup; use `ozone-platform=x11` on X11 sessions and keep `ozone-platform-hint=auto` + `WaylandWindowDecorations` only on Wayland. Also added `--disable-gpu-memory-buffer-video-frames` to cap GPU process memory from HA camera / video streams.
- **`sendMediaService` socket leak** — the `net.request` for media key calls (play/pause, next, previous) had no `response` handler, so the response body was never drained and the socket was never released. Added `response.on('data')` + `on('end')` drain (same pattern as `postSensor`).
- **Duplicate sensor tick loops** — `startSensorReporting()` is called at startup and again on every `save-settings` invocation. `clearTimeout(sensorTickTimer)` only cancels the *next scheduled* tick, not a tick that is currently mid-execution. A mid-flight tick would complete, reschedule itself, and run in parallel with the new tick loop — multiplying sensor POST traffic with each preferences save. Fixed with a generation counter: superseded ticks detect the mismatch and exit without rescheduling.
- **`inject.js` innerHTML** — title bar element was built with `innerHTML`; replaced with `createElement` + `textContent`.
- **`syncTheme` no-op** — `isDark` appeared as a bare JS identifier in the injected string instead of an interpolated value (`${isDark}`), causing a silent `ReferenceError` in the renderer. Theme attribute is now correctly set on `<html>`.

---

## [1.0.29] — 2026-05-19

### Changed
- CI: workflow now triggers only on changes to `src/**`, `package.json`, `package-lock.json`, or `.github/workflows/**` — docs-only pushes no longer produce a release

---

## [1.0.28] — 2026-05-19

### Added
- **Multi-server profiles** — manage multiple HA instances from Preferences → Servers; switch instantly via a tray radio submenu
- **Startup Dashboard Path** — configure a specific Lovelace path to open on launch (e.g. `/lovelace/home`)
- **Window state persistence** — size, position, and maximized state are saved and restored across restarts
- **WebSocket connection monitor** — real-time connection status via HA WebSocket API; Smart Connect HTTP health checks reduced to every 5 minutes as a fallback
- **Wayland native support** — Linux builds now enable `ozone-platform-hint=auto` and `WaylandWindowDecorations` automatically; no extra flags required
- `get-servers` / `save-servers` IPC handlers
- `getServers` / `saveServers` exposed via `preload-prefs.js`
- **Full documentation** — complete wiki in `docs/` (Installation, Configuration, Smart Connect, Sensors, Multi-Server, Power User, Troubleshooting, Development, Changelog)
- **Rewritten README** — feature table, sensor entity reference, keyboard shortcuts, build instructions

### Changed
- Smart Connect health check interval: 20 s → 300 s (WebSocket provides real-time status)
- Tray context menu now built by `updateTrayMenu()` and rebuilt on every server switch

---

## [1.0.27] — 2026-05-19

### Fixed
- **Memory leak / OOM crash** — undrained HTTP response bodies in `postSensor` and `healthCheckRequest` were keeping sockets and memory alive; fixed by consuming the response body (`response.on('data', () => {})`)
- **Duplicate `reportSensor` function** — a synchronous shadow declaration hoisted over the async version, causing all sensor reports to fail silently; duplicate removed
- **`nativeTheme` listener leak** — theme sync listener was not unregistered on window close; fixed with `mainWindow.once('closed', () => nativeTheme.off(...))`
- **`insertCSS` key leak** — custom CSS was re-inserted without removing the previous key, accumulating dead CSS rules
- **PowerShell console windows flashing** — all `exec()` calls on Windows now include `{ windowsHide: true }` (fixes [issue #7](https://github.com/nexos20lv/Home-Assistant-Desktop/issues/7))
- **XSS in inject.js** — disconnect button was built with `innerHTML`; replaced with DOM API (`createElementNS`, `setAttribute`, `textContent`)
- **Command injection in osascript calls** — replaced `exec(\`osascript -e ${script}\`)` with `execFile('osascript', ['-e', script])`
- **Deep link path traversal** — `handleDeepLink` now validates that the target URL shares the same origin as the configured HA URL
- **CPU usage clamp** — values now clamped to `[0, 100]`
- **French hardcoded strings in setup wizard** — `index.html` was displaying French text for all users
- **IPC listener duplication** — `onNetworkStatus` now calls `removeAllListeners` before re-registering
- **PiP window security** — `nodeIntegration: false, contextIsolation: true` added

### Added
- **Multi-language support (i18n)** — 7 languages: EN, FR, ES, DE, IT, PT, NL
- **Preferences menu item** — added to right-click context menu and application menu bar (`Ctrl + ,`)
- SPA navigation detection in `inject.js` via `pushState` / `replaceState` / `popstate` intercepts (removed 500 ms `setInterval`)
- Parallelized sensor collection and reporting with `Promise.all`
- Sensor delivery queue with retry (up to 1 000 queued reports, retry every 10 s)

---

## [1.0.26] — 2025

### Added
- Initial multi-language support framework

---

## [1.0.25] — 2025

### Added
- Smart Connect v2 — automatic failover between local and remote HA URLs
- Picture-in-Picture window
- Power Saver Mode for sensors
- DND / Focus sync sensor
- Active App sensor
- Global keyboard shortcut (`Ctrl + Alt + H`)
- Display scale setting (80 % – 110 %)
- Custom CSS injection
- Startup scripts with safe-mode dialog
- Biometric lock (TouchID / Windows Hello)
- Auto-updates via `update-electron-app`
- System tray with context menu

---

## [1.0.0] — Initial release

- Setup wizard (3 steps: local URL, remote URL, API token)
- HA dashboard in a native window with custom title bar
- CPU / RAM / battery / status sensors
- Media key integration
- Deep linking via `ha-desktop://`
- Dark mode sync with OS theme
- Single-instance enforcement
