# Development

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 22.x or later |
| npm | 10.x or later |
| Git | Any recent version |

---

## Getting started

```bash
git clone https://github.com/nexos20lv/Home-Assistant-Desktop.git
cd Home-Assistant-Desktop
npm install
npm start
```

`npm start` launches Electron in development mode with DevTools accessible via `Ctrl + Shift + I` (Windows/Linux) or `Cmd + Option + I` (macOS) inside the shell window.

---

## Project structure

```
Home-Assistant-Desktop/
├── src/
│   ├── main/
│   │   ├── main.js           # Electron main process (all app logic)
│   │   ├── preload.js        # Context bridge for shell.html
│   │   └── preload-prefs.js  # Context bridge for preferences.html
│   ├── renderer/
│   │   ├── shell.html        # Custom title bar (always shown above the HA view)
│   │   ├── shell.css         # Title bar styles
│   │   ├── index.html        # Setup wizard
│   │   ├── renderer.js       # Setup wizard logic
│   │   ├── styles.css        # Setup wizard styles
│   │   ├── preferences.html  # Preferences window (all settings UI)
│   │   ├── inject.js         # Script injected into the HA BrowserView
│   │   └── inject.css        # Styles injected into the HA BrowserView
│   ├── locales/
│   │   ├── translations.json # All UI strings for 7 languages
│   │   └── i18n.js           # Translation loader (used in renderer contexts)
│   └── assets/
│       ├── logo.png
│       ├── logo.ico
│       └── logo.svg
├── docs/                     # Wiki pages (this directory)
├── scripts/
│   └── convert-icon.js       # Icon conversion helper
└── package.json
```

---

## Architecture

### Process model

```
┌─────────────────────────────────────────────────────┐
│ Main Process (main.js)                              │
│  • Electron app lifecycle                           │
│  • electron-store (settings persistence)            │
│  • keytar (secure token storage)                    │
│  • Smart Connect monitor (HTTP health checks)       │
│  • WebSocket monitor (HA real-time connection)      │
│  • Sensor collection and reporting (net.request)    │
│  • IPC handlers                                     │
│  • System tray                                      │
│  • Deep link handler                               │
└──────────┬──────────────────┬───────────────────────┘
           │ IPC              │ IPC
┌──────────▼────────┐  ┌──────▼──────────────────────┐
│ shell.html        │  │ preferences.html             │
│ (BrowserWindow)   │  │ (BrowserWindow, modal-less)  │
│  • Title bar      │  │  • 5 tabs: General /         │
│  • PiP button     │  │    Sensors / Advanced /      │
│  • Network pill   │  │    Servers / Translations    │
│  • Prefs button   │  │  • preload-prefs.js bridge   │
│  • preload.js     │  └──────────────────────────────┘
└──────────┬────────┘
           │ BrowserView (embedded)
┌──────────▼────────────────────────────────────────┐
│ Home Assistant BrowserView                        │
│  • partition: persist:homeassistant               │
│  • inject.js (disconnect button, SPA navigation)  │
│  • inject.css                                     │
│  • Custom CSS from preferences                    │
└───────────────────────────────────────────────────┘
```

### Key patterns

**Context isolation** — All renderer windows use `contextIsolation: true` and `nodeIntegration: false`. Communication goes through `contextBridge` in preload scripts. The HA BrowserView has no preload at all for maximum isolation.

**electron-store** — All user settings are persisted via `electron-store`. The store is only accessed from the main process. Sensitive data (API token) is stored in the OS keychain via `keytar`.

**Sensor delivery queue** — Failed sensor POST requests are queued (up to 1000 entries) and retried every 10 seconds via `sensorDeliveryState`. This prevents data loss during connectivity gaps.

**Smart Connect** — `evaluateSmartConnect()` runs every 5 minutes and checks both URLs in parallel. It enforces a 2-minute cooldown on switches to prevent flapping.

**WebSocket monitor** — `connectHaWebSocket()` uses the Node.js 22 built-in `WebSocket` global to connect to `/api/websocket`. Auth handshake is performed, and the socket auto-reconnects after 8 seconds on close.

**SPA navigation detection** — `inject.js` patches `history.pushState` and `history.replaceState` and listens to `popstate` to detect HA's React-based navigation without polling.

---

## Building a production installer

```bash
npm run make
```

This runs `electron-forge make` and produces:

| OS | Output |
|---|---|
| Windows | `out/make/squirrel.windows/x64/*.exe` |
| macOS | `out/make/dmg/*.dmg` |
| Linux (deb) | `out/make/deb/x64/*.deb` |
| Linux (rpm) | `out/make/rpm/x64/*.rpm` |

The CI pipeline (`.github/workflows/release.yml`) runs `make` on all three platforms in parallel and attaches the artifacts to a GitHub Release.

---

## Adding a translation

1. Open `src/locales/translations.json`.
2. Copy the `"en"` block and add a new key for your language (e.g. `"ja"` for Japanese).
3. Translate all string values. Do not change the keys.
4. Add the language option to the `<select>` in `src/renderer/index.html` and `src/renderer/preferences.html`.
5. Submit a pull request.

---

## IPC reference

### Shell (preload.js → main.js)

| Channel | Direction | Description |
|---|---|---|
| `save-config` | invoke | Save URL from setup wizard |
| `save-onboarding-config` | invoke | Save full onboarding config |
| `test-ha-connection` | invoke | Test a URL/token pair |
| `config-saved` | send | Signal setup complete → open main window |
| `reset-config` | invoke | Wipe config and relaunch |
| `open-preferences` | send | Open Preferences window |
| `toggle-pip` | send | Show/hide PiP window |
| `switch-server` | send | Switch active server by ID |
| `network-status` | receive | Connection status update from main |

### Preferences (preload-prefs.js → main.js)

| Channel | Direction | Description |
|---|---|---|
| `get-settings` | invoke | Load all settings |
| `save-settings` | invoke | Save all settings |
| `get-servers` | invoke | Load server profiles |
| `save-servers` | invoke | Save server profiles |
| `get-error-logs` | invoke | Get recent log entries |
| `export-error-logs` | invoke | Save logs to disk |
| `open-external` | send | Open URL in default browser |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes
4. Test with `npm start`
5. Submit a pull request against `main`

Please open an issue first for anything beyond a small bug fix so we can discuss the approach before you invest time in the implementation.
