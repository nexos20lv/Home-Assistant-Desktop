# CLAUDE.md — Home Assistant Desktop

Project context and conventions for Claude Code. Read this before touching any file.

---

## What this project is

An Electron desktop client for Home Assistant. It wraps the HA web UI in a native shell and adds OS-level features: hardware sensors reported to HA, Smart Connect URL failover, multi-server profiles, deep linking, PiP, biometric lock, media keys, custom CSS injection, startup scripts, and more.

**Current version:** 1.0.29  
**GitHub:** https://github.com/nexos20lv/Home-Assistant-Desktop  
**License:** MIT  
**Author:** NeXoS_20

---

## CI / release rules — READ FIRST

Every push to `main` that touches `src/**`, `package.json`, `package-lock.json`, or `.github/workflows/**` **automatically builds and publishes a new release** on all three platforms (Windows, macOS, Linux) via GitHub Actions.

Version is `1.0.<github.run_number>` — it increments on every triggered run.

**Rules:**
- Always add `[skip ci]` to commit messages for docs-only changes (`docs/`, `README.md`, `USER_GUIDE.md`, `CLAUDE.md`)
- Never push trivial changes to `src/` just to test — they create real releases
- Batch related code changes into a single commit/push when possible
- The CI commit-bump itself uses `[skip ci]` to avoid infinite loops

---

## Repository structure

```
src/
  main/
    main.js           ← Electron main process (~1600 lines). ALL app logic lives here.
    preload.js        ← contextBridge for shell.html (IPC to main)
    preload-prefs.js  ← contextBridge for preferences.html (IPC to main)
  renderer/
    shell.html        ← Custom title bar (always shown above the HA BrowserView)
    shell.css         ← Title bar styles
    index.html        ← 3-step setup wizard
    renderer.js       ← Setup wizard logic
    styles.css        ← Setup wizard styles
    preferences.html  ← All settings UI (5 tabs: General/Sensors/Advanced/Servers/Translations)
    inject.js         ← Injected into the HA BrowserView (disconnect button, SPA nav detection)
    inject.css        ← Injected styles
  locales/
    translations.json ← All UI strings for 7 languages (en/fr/es/de/it/pt/nl)
    i18n.js           ← Translation loader used in renderer contexts
  assets/
    logo.png / logo.ico / logo.svg
docs/                 ← Wiki pages (docs-only, no CI trigger)
.github/workflows/
  release.yml         ← Build & release pipeline
```

---

## Architecture

### Process model

```
Main Process (main.js)
  ├── BrowserWindow: shell.html  ←→  preload.js
  │     └── BrowserView: Home Assistant  (partition: persist:homeassistant)
  │           └── inject.js + inject.css injected after load
  └── BrowserWindow: preferences.html  ←→  preload-prefs.js  (modal-less)
```

- `contextIsolation: true`, `nodeIntegration: false` everywhere
- The HA BrowserView has **no preload** — maximum isolation
- All IPC is typed via `contextBridge.exposeInMainWorld`

### Key state (module-level in main.js)

```js
store          // electron-store — all persistent settings
haWsManager    // { ws, reconnectTimer, isConnected } — HA WebSocket connection
smartConnectState // { healthIntervalMs: 300000, cooldownMs: 120000, ... }
sensorDeliveryState // queue + retry for failed sensor POSTs
appLogBuffer   // last 300 log entries (shown in Preferences → Advanced)
mainWindow     // BrowserWindow ref
view           // BrowserView ref (the HA dashboard)
tray           // Tray ref
```

---

## IPC reference

### shell preload.js → main.js

| Channel | Type | Description |
|---|---|---|
| `save-config` | invoke | Save URL from setup wizard |
| `save-onboarding-config` | invoke | Save full onboarding config |
| `test-ha-connection` | invoke | Test a URL/token pair |
| `config-saved` | send | Setup complete → open main window |
| `reset-config` | invoke | Wipe config and relaunch |
| `open-preferences` | send | Open Preferences window |
| `toggle-pip` | send | Show/hide PiP window |
| `switch-server` | send | Switch active server by ID string |
| `network-status` | receive | Status update from main → shell |

### preload-prefs.js → main.js

| Channel | Type | Description |
|---|---|---|
| `get-settings` | invoke | Load all settings |
| `save-settings` | invoke | Save all settings |
| `get-servers` | invoke | Load server profiles array |
| `save-servers` | invoke | Save server profiles + set active |
| `get-error-logs` | invoke | Recent log entries |
| `export-error-logs` | invoke | Save logs to disk |
| `open-external` | send | Open URL in default browser |

---

## electron-store keys

| Key | Type | Default | Description |
|---|---|---|---|
| `haUrl` | string | — | Active local HA URL |
| `remoteUrl` | string | — | Active remote URL |
| `useRemote` | bool | false | Force remote |
| `smartConnectEnabled` | bool | true | Auto-failover |
| `startupPath` | string | '' | Relative path opened on launch |
| `servers` | array | null | Multi-server profiles (migrated from haUrl on first load) |
| `activeServerId` | string | — | ID of the active server profile |
| `displayScale` | number | 100 | Zoom factor (50–200) |
| `customCSS` | string | '' | CSS injected into HA BrowserView |
| `startupScripts` | string | '' | Shell commands run at launch |
| `startupScriptsSafeMode` | bool | true | Show confirmation before scripts |
| `reportMedia` | bool | true | Master mic/camera toggle |
| `reportDnd` | bool | true | DND sensor |
| `reportMic` | bool | true | Microphone sensor |
| `reportCamera` | bool | true | Camera sensor |
| `reportActiveApp` | bool | true | Active app sensor |
| `sensorIntervalMinutes` | number | 1 | 1 / 5 / 15 |
| `powerSaverMode` | bool | false | Reduce frequency on battery |
| `autoLaunch` | bool | false | Login item |
| `globalShortcut` | bool | false | Ctrl+Alt+H toggle |
| `autoUpdates` | bool | true | update-electron-app |
| `biometricLock` | bool | false | TouchID / Windows Hello |
| `mediaPlayerEntity` | string | 'media_player.all' | Media key target |
| `windowBounds` | object | {w:1200,h:800} | Saved window geometry |
| `windowMaximized` | bool | false | Restore maximized state |
| `app-language` | string | system | UI language code |

**Secure storage (keytar):** API token stored as `TOKEN_SERVICE = 'home-assistant-desktop'`, `TOKEN_ACCOUNT = 'ha-api-token'`. Use `getApiToken()` / `setApiToken()` — never read it directly from the store.

---

## Critical patterns and invariants

### HTTP response body draining
Every `net.request` **must** drain the response body or the socket leaks:
```js
request.on('response', (response) => {
    response.on('data', () => {});  // drain — mandatory
    response.on('end', () => resolve({ ok: response.statusCode < 400 }));
    response.on('error', () => resolve({ ok: false }));
});
```
This was the root cause of the OOM crash fixed in v1.0.27. Never skip it.

### No innerHTML in injected scripts
`inject.js` runs inside the HA page. Use DOM API only (`createElement`, `setAttribute`, `textContent`). Never use `innerHTML` — XSS risk.

### execFile over exec for external commands
Use `execFile('osascript', ['-e', script])` not `exec(\`osascript -e ${script}\`)`. Template literals in exec = command injection.

### windowsHide on all exec() calls
All `exec()` / `execPromise()` calls on Windows must include `{ windowsHide: true }` to suppress visible console windows.

### Deep link origin validation
`handleDeepLink` must validate that the target URL's origin matches the configured HA URL. Reject cross-origin paths silently.

### IPC listener deduplication
Before registering any `ipcRenderer.on(channel, ...)`, call `ipcRenderer.removeAllListeners(channel)` to prevent accumulation across hot-reloads.

### updateTrayMenu() after any server change
After `switchToServer()` or `save-servers`, always call `updateTrayMenu()` to rebuild the tray context menu with the new radio state.

---

## Smart Connect + WebSocket

- **WebSocket** (`connectHaWebSocket`): connects to `/api/websocket`, does auth handshake, reconnects after 8 s on close. Provides real-time status.
- **HTTP health check** (`evaluateSmartConnect`): runs every **300 s** as a failover detector. Has a **120 s cooldown** on switches to prevent flapping.
- After switching servers, reset `smartConnectState.currentTarget = 'unknown'` before calling `evaluateSmartConnect()`.

---

## Sensor delivery queue

Failed sensor POSTs go into `sensorDeliveryState.queue` (max 1000 items). A `setInterval` every 10 s calls `flushSensorQueue()`. Items older than their `nextAttemptAt` are replayed. Exponential backoff is applied on repeated failures.

---

## Multi-server profiles

`servers[]` in the store. Auto-migrated from `haUrl`/`remoteUrl` on first load by `loadServers()`. Each entry: `{ id, name, localUrl, remoteUrl, useRemote, smartConnect }`. `switchToServer(id)` updates the store keys, reloads the view, and calls `updateTrayMenu()`.

---

## Sensor entity IDs

| Entity | Description |
|---|---|
| `sensor.desktop_cpu_usage` | CPU % |
| `sensor.desktop_memory_usage` | RAM % |
| `sensor.desktop_status` | Active / Idle |
| `sensor.desktop_uptime` | Hours |
| `sensor.desktop_battery_level` | Battery % |
| `sensor.desktop_battery_status` | charging / discharging |
| `sensor.desktop_active_app` | Foreground app name |
| `binary_sensor.desktop_microphone` | Mic in use |
| `binary_sensor.desktop_camera` | Camera in use |
| `binary_sensor.desktop_dnd` | DND active |

---

## Platform notes

| Feature | Windows | macOS | Linux |
|---|---|---|---|
| Active app | PowerShell | AppleScript | — |
| DND | PowerShell (Focus Assist registry) | AppleScript | — |
| Mic/Camera | PowerShell | lsof / AppleScript | — |
| Battery | PowerShell WMI | pmset | /sys/class/power_supply |
| Wayland | — | — | ozone-platform-hint=auto |

---

## Languages

7 languages in `src/locales/translations.json`: `en`, `fr`, `es`, `de`, `it`, `pt`, `nl`.  
To add a language: add a key in `translations.json` and an `<option>` in `index.html` and `preferences.html`.

---

## What NOT to do

- Never add `[skip ci]` to a code commit — releases must be built
- Never use `innerHTML` in `inject.js`
- Never call `exec()` with template-literal user input — use `execFile`
- Never forget to drain response bodies in `net.request` handlers
- Never amend or force-push `main` — CI tags commits, force-push breaks the release graph
- Never store the API token in electron-store — use `getApiToken()` / `setApiToken()` (keytar)
- Never batch unrelated features in one commit if they affect separate concerns
