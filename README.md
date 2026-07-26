<div align="center">

  <img src="https://capsule-render.vercel.app/api?type=waving&color=8A2BE2&height=200&section=header&text=Home%20Assistant%20Desktop&fontSize=42&fontAlignY=40&animation=twinkling&desc=A%20native,%20OS-integrated%20desktop%20client&descAlignY=60&descAlign=50" alt="Home Assistant Desktop Banner" />

  <p align="center">
    <a href="https://github.com/nexos20lv/Home-Assistant-Desktop/releases/latest">
      <img src="https://img.shields.io/github/v/release/nexos20lv/Home-Assistant-Desktop?style=for-the-badge&color=34C759" alt="Version">
    </a>
    <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-007AFF?style=for-the-badge" alt="Platform">
    <img src="https://img.shields.io/github/downloads/nexos20lv/Home-Assistant-Desktop/total?style=for-the-badge&label=Downloads&color=0A84FF" alt="Downloads">
    <img src="https://img.shields.io/github/actions/workflow/status/nexos20lv/Home-Assistant-Desktop/release.yml?style=for-the-badge&label=Build" alt="Build">
    <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="License">
  </p>

</div>

---

### 📖 About

**Home Assistant Desktop** is more than just a browser wrapper — it turns your PC into a first-class Home Assistant device by reporting local hardware sensors, syncing OS state, and letting you control your home directly from your desktop.

---

## ✨ Features at a glance

| Category | Description |
|---|---|
| **Smart Connect** | Auto-switches between local and remote HA URLs; WebSocket keeps connection status real-time |
| **Desktop Sensors** | Reports CPU, RAM, battery, uptime, active app, mic/camera usage, and DND mode to HA |
| **Multi-Server** | Switch between multiple HA instances seamlessly via the system tray or Preferences |
| **Startup Dashboard** | Automatically opens any Lovelace view on launch (e.g. `/lovelace/home`) |
| **Window Persistence** | Remembers size, position, and window state across restarts |
| **Biometric Lock** | Protect access with TouchID or Windows Hello before opening |
| **Media Keys** | Route physical keyboard media keys directly to a Home Assistant media player |
| **PiP Window** | Floating, always-on-top panel for live camera feeds or quick controls |
| **Deep Linking** | Use `ha-desktop://path` to open specific views from external scripts or shortcuts |
| **Custom CSS** | Easily hide headers, tweak card designs, or apply custom fonts |
| **Startup Scripts** | Execute local shell commands on application startup (with safety prompts) |
| **Localization** | Available in **7 languages** (EN · FR · ES · DE · IT · PT · NL) |
| **Wayland Support** | Native Wayland window decorations on Linux (no XWayland required) |

---

## 📦 Installation

<table width="100%">
  <tr>
    <td align="center" width="33%">
      <h3>🪟 Windows</h3>
      <a href="https://github.com/nexos20lv/Home-Assistant-Desktop/releases/latest"><b>Download .exe</b></a><br>
      <sub>Squirrel installer with auto-updates</sub>
    </td>
    <td align="center" width="33%">
      <h3>🍎 macOS</h3>
      <a href="https://github.com/nexos20lv/Home-Assistant-Desktop/releases/latest"><b>Download .dmg</b></a><br>
      <sub>Universal binary (Intel + Apple Silicon)</sub>
    </td>
    <td align="center" width="33%">
      <h3>🐧 Linux</h3>
      <a href="https://github.com/nexos20lv/Home-Assistant-Desktop/releases/latest"><b>Download .deb / .rpm</b></a><br>
      <sub>Native Wayland & X11 support</sub>
    </td>
  </tr>
</table>

<details>
<summary><b>🍎 macOS — "App is damaged" or Quarantine issue?</b></summary>
<br>

If macOS blocks the app on first launch, run this command in your Terminal:

```sh
xattr -d com.apple.quarantine "/Applications/Home Assistant Desktop.app"
