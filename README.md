# <img src="src/assets/logo.png" width="48" align="center"> Home Assistant Desktop

<p align="left">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-007AFF?style=for-the-badge" alt="Platform">
  <img src="https://img.shields.io/github/v/release/nexos20lv/Home-Assistant-Desktop?style=for-the-badge&color=34C759" alt="Version">
  <img src="https://img.shields.io/github/downloads/nexos20lv/Home-Assistant-Desktop/total?style=for-the-badge&label=Downloads&color=0A84FF" alt="Downloads">
  <img src="https://img.shields.io/github/actions/workflow/status/nexos20lv/Home-Assistant-Desktop/release.yml?style=for-the-badge&label=Build" alt="Build">
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="License">
</p>

**A native, OS-integrated desktop client for Home Assistant.** More than a browser wrapper — it turns your PC into a first-class Home Assistant device, reporting hardware sensors, syncing OS state, and letting you control your home from the keyboard.

---

## Features at a glance

| Category | What it does |
|---|---|
| **Smart Connect** | Auto-switches between your local and remote HA URL; WebSocket keeps connection status real-time |
| **Desktop Sensors** | Reports CPU, RAM, battery, uptime, active app, mic/camera state, and Do-Not-Disturb to HA |
| **Multi-Server** | Manage several HA instances from the tray and Preferences → Servers |
| **Startup Dashboard** | Open any Lovelace view on launch (e.g. `/lovelace/home`) |
| **Window Persistence** | Remembers size, position, and maximized state across restarts |
| **Biometric Lock** | TouchID / Windows Hello before the window shows |
| **Media Keys** | Physical keyboard media keys routed to a HA media player entity |
| **PiP Window** | Tear off a floating always-on-top panel for cameras or dashboards |
| **Deep Linking** | `ha-desktop://path` opens a specific page from any app or shortcut |
| **Custom CSS** | Inject styles to hide the HA header, tweak cards, change fonts |
| **Startup Scripts** | Run local shell commands when the app launches (with safe-mode prompt) |
| **7 languages** | EN · FR · ES · DE · IT · PT · NL |
| **Wayland** | Native Wayland window decorations on Linux (no XWayland required) |

---

## Installation

<table width="100%">
  <tr>
    <td align="center" width="33%">
      <h3>🪟 Windows</h3>
      <a href="https://github.com/nexos20lv/Home-Assistant-Desktop/releases/latest"><b>Download .exe</b></a><br>
      <sub>Squirrel installer, auto-updates included</sub>
    </td>
    <td align="center" width="33%">
      <h3>🍎 macOS</h3>
      <a href="https://github.com/nexos20lv/Home-Assistant-Desktop/releases/latest"><b>Download .dmg</b></a><br>
      <sub>Universal binary (Intel + Apple Silicon)</sub>
    </td>
    <td align="center" width="33%">
      <h3>🐧 Linux</h3>
      <a href="https://github.com/nexos20lv/Home-Assistant-Desktop/releases/latest"><b>Download .deb / .rpm</b></a><br>
      <sub>Native Wayland + X11 support</sub>
    </td>
  </tr>
</table>

<details>
<summary><b>macOS — "App is damaged" error</b></summary>

Run this once in Terminal after moving the app to Applications:

```sh
xattr -d com.apple.quarantine "/Applications/Home Assistant Desktop.app"
```
</details>

---

## Quick start

1. **Launch** the app — you'll see the 3-step setup wizard.
2. **Step 1 — Local URL**: enter your HA address (e.g. `http://homeassistant.local:8123`).
3. **Step 2 — Remote URL** *(optional)*: your Nabu Casa or DuckDNS URL for when you're away from home.
4. **Step 3 — API Token** *(optional)*: a Long-Lived Access Token from your HA profile, needed for sensor reporting.
5. Click **Finish** — the main window opens and your dashboard loads.

> Smart Connect automatically picks the fastest reachable URL on every launch.

---

## Desktop sensors

The app creates Home Assistant entities automatically when a valid API token is configured.

| Entity | Type | Description |
|---|---|---|
| `sensor.desktop_cpu_usage` | sensor | CPU load (%) |
| `sensor.desktop_memory_usage` | sensor | RAM used (%) |
| `sensor.desktop_status` | sensor | `Active` / `Idle` |
| `sensor.desktop_uptime` | sensor | System uptime (hours) |
| `sensor.desktop_battery_level` | sensor | Battery % (laptops) |
| `sensor.desktop_battery_status` | sensor | `charging` / `discharging` |
| `sensor.desktop_active_app` | sensor | Foreground app name |
| `binary_sensor.desktop_microphone` | binary sensor | Mic in use |
| `binary_sensor.desktop_camera` | binary sensor | Camera in use |
| `binary_sensor.desktop_dnd` | binary sensor | Do-Not-Disturb active |

All sensors are configurable individually in **Preferences → Sensors**. Reporting interval: 1 / 5 / 15 minutes. Power Saver Mode reduces frequency on battery.

---

## Multi-server profiles

Go to **Preferences → Servers** to add multiple HA instances (home, office, vacation house…). The tray icon shows a radio submenu to switch between them instantly — no reconfiguration needed.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl / Cmd + ,` | Open Preferences |
| `Ctrl + Alt + H` | Toggle window visibility (Boss Mode) — enable in Preferences |
| Media Play/Pause / Next / Prev | Control the configured HA media player |

---

## Build from source

```bash
git clone https://github.com/nexos20lv/Home-Assistant-Desktop.git
cd Home-Assistant-Desktop
npm install
npm start          # development
npm run make       # production installer
```

Requires Node.js 22+ and npm 10+.

---

## Contributing

Pull requests are welcome. Please open an issue first for anything larger than a bug fix.  
See [docs/Development.md](docs/Development.md) for architecture notes and build instructions.

---

## Support

<p align="center">
  <a href="https://buymeacoffee.com/nexos20">
    <img src="https://img.shields.io/badge/Buy_Me_A_Coffee-Support_Development-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me A Coffee">
  </a>
</p>

---

*Crafted with care by [NeXoS_20](https://github.com/nexos20lv) · MIT License*
