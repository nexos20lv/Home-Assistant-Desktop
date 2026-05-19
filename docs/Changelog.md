# Changelog

All notable changes are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.27] — Unreleased

### Added
- **Multi-server profiles** — manage multiple HA instances from Preferences → Servers; switch instantly via a tray radio submenu
- **Startup Dashboard Path** — configure a specific Lovelace path to open on launch (e.g. `/lovelace/home`)
- **Window state persistence** — size, position, and maximized state are saved and restored across restarts
- **WebSocket connection monitor** — replaces the 20-second HTTP polling loop for real-time connection status; Smart Connect HTTP health checks now run every 5 minutes as a fallback
- **Wayland native support** — Linux builds now enable `ozone-platform-hint=auto` and `WaylandWindowDecorations` automatically; no extra flags required
- `get-servers` / `save-servers` IPC handlers
- `getServers` / `saveServers` exposed via `preload-prefs.js`

### Changed
- Smart Connect health check interval: 20 s → 300 s (WebSocket covers real-time status)
- Tray context menu now built by `updateTrayMenu()` and rebuilt on every server switch

---

## [1.0.26] — 2025

### Fixed
- **Memory leak / OOM crash** — undrained HTTP response bodies in `postSensor` were keeping sockets open; fixed by consuming the response body (`response.on('data', () => {})`)
- **Duplicate `reportSensor` function** — a synchronous shadow declaration at line ~1349 was hoisted over the correct async version, causing all sensor reports to use the broken sync path; removed the duplicate
- **`nativeTheme` listener leak** — theme sync listener was not unregistered on window close; fixed with `mainWindow.once('closed', () => nativeTheme.off(...))`
- **`insertCSS` key leak** — custom CSS was re-inserted without removing the previous key; now tracked and removed before re-insertion
- **`windowsHide: true` missing** — all `exec()` calls on Windows now include `{ windowsHide: true }` to suppress visible PowerShell console windows (fixes issue #7)
- **XSS in inject.js** — disconnect button was built with `innerHTML`; replaced with DOM API (`createElementNS`, `createElement`, `setAttribute`)
- **Command injection in osascript calls** — replaced `exec(\`osascript -e ${script}\`)` with `execFile('osascript', ['-e', script])`
- **Deep link path traversal** — `handleDeepLink` now validates that the target URL shares the same origin as the configured HA URL
- **CPU usage clamp** — values now clamped to `[0, 100]` via `Math.max(0, Math.min(100, ...))`
- **French hardcoded strings** — setup wizard (`index.html`) was displaying French text for all users; replaced with English
- **IPC listener duplication** — `onNetworkStatus` now calls `ipcRenderer.removeAllListeners('network-status')` before re-registering

### Added
- **Multi-language support** — 7 languages: EN, FR, ES, DE, IT, PT, NL
- **Preferences menu item** — added to right-click context menu and application menu bar
- **`windowsHide: true`** on all Windows `exec()` calls
- PiP window security: `nodeIntegration: false, contextIsolation: true`
- SPA navigation detection in `inject.js` via `pushState`/`replaceState`/`popstate` intercepts (removed 500ms `setInterval`)
- Parallelized sensor collection with `Promise.all`
- Sensor delivery queue with retry (up to 1000 queued reports, retry every 10 s)

---

## [1.0.25] — 2025

### Added
- Smart Connect v2 — automatic failover between local and remote HA URLs
- Picture-in-Picture window
- Power Saver Mode for sensors
- DND / Focus sync sensor
- Active App sensor
- Global keyboard shortcut (`Ctrl + Alt + H`)
- Display scale setting (80% – 110%)
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
