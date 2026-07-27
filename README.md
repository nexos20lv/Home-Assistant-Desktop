<div align="center">

  <img src="https://capsule-render.vercel.app/api?type=waving&color=8A2BE2&height=200&section=header&text=Home%20Assistant%20Desktop&fontSize=42&fontAlignY=40&animation=twinkling&desc=A%20native,%20OS-integrated%20desktop%20client&descAlignY=60&descAlign=50&fontColor=ffffff" alt="Home Assistant Desktop Banner" />

  <p align="center">
    <a href="https://github.com/nexos20lv/Home-Assistant-Desktop/releases/latest">
      <img src="https://img.shields.io/github/v/release/nexos20lv/Home-Assistant-Desktop?style=for-the-badge&color=34C759" alt="Version">
    </a>
    <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-007AFF?style=for-the-badge" alt="Platform">
    <img src="https://img.shields.io/github/downloads/nexos20lv/Home-Assistant-Desktop/total?style=for-the-badge&label=Downloads&color=0A84FF" alt="Downloads">
    <img src="https://img.shields.io/github/actions/workflow/status/nexos20lv/Home-Assistant-Desktop/release.yml?style=for-the-badge&label=Build" alt="Build">
    <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="License">
  </p>

  <p align="center">
    <a href="#-features-at-a-glance">Features</a> •
    <a href="#-installation">Installation</a> •
    <a href="#-pc-sensors-integration">Desktop Sensors</a> •
    <a href="#-documentation">Docs</a> •
    <a href="#-support--community">Support</a>
  </p>

</div>

---

## 📖 Overview

**Home Assistant Desktop** turns your computer into a first-class Home Assistant node. Far beyond a simple browser wrapper, it integrates deeply with your operating system to report real-time hardware telemetry (CPU, RAM, Battery, Active App, Camera & Microphone state, DND mode), support multi-server switching, handle physical media keys, enable biometric security, and auto-failover between local and remote URLs.

---

## ✨ Features at a glance

<table width="100%">
  <tr>
    <td width="50%" valign="top">
      <h3>⚡ Core & Connectivity</h3>
      <ul>
        <li><b>Smart Connect:</b> Automatic failover between local and remote URLs with zero interruption.</li>
        <li><b>Multi-Server Profiles:</b> Switch between multiple Home Assistant instances instantly via System Tray or Preferences.</li>
        <li><b>Startup Dashboard:</b> Open any custom Lovelace path on startup (e.g., <code>/lovelace/home</code>).</li>
        <li><b>Deep Linking:</b> Trigger views or automation scripts via <code>ha-desktop://</code> URLs.</li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h3>🖥️ Desktop Integration</h3>
      <ul>
        <li><b>Hardware Telemetry:</b> Reports CPU, RAM, Battery, Uptime, Active App, Mic/Cam usage, and Focus Mode.</li>
        <li><b>Media Keys Integration:</b> Control Home Assistant media players with your physical keyboard keys.</li>
        <li><b>Picture-in-Picture (PiP):</b> Floating, always-on-top window for live camera streams or controls.</li>
        <li><b>Biometric Security:</b> Lock the app with TouchID or Windows Hello.</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>🎨 Customization & Control</h3>
      <ul>
        <li><b>Custom CSS Injection:</b> Easily hide navigation elements, tweak card styles, or apply custom themes.</li>
        <li><b>Startup Scripts:</b> Execute local shell scripts when the app launches (with safety confirmation).</li>
        <li><b>Window Memory:</b> Remembers bounds, position, zoom level, and maximized state across restarts.</li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h3>🌐 Internationalization & Platform</h3>
      <ul>
        <li><b>7 Languages Supported:</b> English, French, Spanish, German, Italian, Portuguese, and Dutch.</li>
        <li><b>Wayland & X11 Native:</b> Intelligent display server backend detection for Linux environments.</li>
        <li><b>Tray Integration:</b> Minimize-to-tray support for 24/7 background sensor reporting.</li>
      </ul>
    </td>
  </tr>
</table>

---

## 📦 Installation

Download the latest version for your platform from the **[Releases Page](https://github.com/nexos20lv/Home-Assistant-Desktop/releases/latest)**.

<table width="100%">
  <tr>
    <td align="center" width="33%">
      <h3>🪟 Windows</h3>
      <a href="https://github.com/nexos20lv/Home-Assistant-Desktop/releases/latest"><b>Download .exe Setup</b></a><br>
      <sub>Squirrel installer with background auto-updates</sub>
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
<summary><b>🍎 macOS — "App is damaged and can't be opened" Bypass Guide</b></summary>
<br>

Because the app is built without a paid Apple Developer signing certificate, macOS Gatekeeper may show a warning on first launch.

To bypass this on macOS:
1. Drag **Home Assistant Desktop.app** into your **`/Applications`** folder.
2. Open **Terminal** and execute:
   ```bash
   xattr -d com.apple.quarantine "/Applications/Home Assistant Desktop.app"
   ```
3. Launch the application normally!
</details>

---

## 📊 PC Sensors Integration

Once configured with a **Long-Lived Access Token**, the app automatically creates and updates native Home Assistant entities every 60 seconds:

| Entity Name | Type | Description |
|---|---|---|
| `sensor.<hostname>_desktop_cpu_usage` | Sensor | CPU usage percentage (%) |
| `sensor.<hostname>_desktop_memory_usage` | Sensor | RAM usage percentage (%) |
| `sensor.<hostname>_desktop_status` | Sensor | System active / idle status |
| `sensor.<hostname>_desktop_uptime` | Sensor | System uptime in hours |
| `sensor.<hostname>_desktop_battery` | Sensor | Battery charge percentage (%) |
| `sensor.<hostname>_desktop_active_app` | Sensor | Name of currently focused window/application |
| `binary_sensor.<hostname>_desktop_microphone` | Binary Sensor | Microphone in-use detector |
| `binary_sensor.<hostname>_desktop_camera` | Binary Sensor | Camera in-use detector |
| `binary_sensor.<hostname>_desktop_dnd` | Binary Sensor | Do Not Disturb / Focus Mode active |

> 💡 **Unique Hardware ID:** Every entity includes a unique hardware ID hashed from your machine's hardware profile, allowing you to freely rename, assign to areas, or customize icons inside Home Assistant Settings.

---

## ⌨️ Shortcuts & Deep Linking

- **Global Shortcut:** Press `Ctrl+Alt+H` (or `Cmd+Alt+H` on Mac) anywhere on your system to toggle the main window.
- **Deep Linking Protocol:** Register custom OS shortcuts or scripts using:
  ```bash
  ha-desktop://lovelace/security
  ```

---

## 📚 Documentation

Detailed documentation for advanced setup is available in our **[docs/](docs/)** folder:

- 📖 **[User Guide](USER_GUIDE.md)** — Complete getting started walkthrough
- 🎨 **[Custom Themes & CSS Guide](docs/Custom-Themes.md)** — Create custom themes, glassmorphism, and dashboard CSS
- 🔌 **[Sensors Setup](docs/Sensors.md)** — Configuring Long-Lived Tokens and sensor polling
- ⚡ **[Smart Connect & Failover](docs/Smart-Connect.md)** — Setting up local vs remote switching
- 🗄️ **[Multi-Server Profiles](docs/Multi-Server.md)** — Managing multiple Home Assistant instances
- 🛠️ **[Development Guide](docs/Development.md)** — Building from source and contribution guide

---

## ☕ Support & Community

If **Home Assistant Desktop** enhances your daily workflow or smart home setup, consider supporting ongoing development:

<div align="center">
  <a href="https://buymeacoffee.com/nexos20">
    <img src="https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Donate%20%E2%98%95-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=white" alt="Buy Me A Coffee">
  </a>
</div>

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more details.
