# <img src="src/assets/logo.png" width="45" align="center"> Home Assistant Desktop

<p align="left">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-007AFF?style=for-the-badge" alt="Platform">
  <img src="https://img.shields.io/github/v/release/nexos20lv/Home-Assistant-Desktop?style=for-the-badge&color=34C759" alt="Version">
  <img src="https://img.shields.io/github/actions/workflow/status/nexos20lv/Home-Assistant-Desktop/release.yml?style=for-the-badge&label=Build" alt="Build">
</p>

### Experience the Future of Smart Home Control.
**Home Assistant Desktop** is more than a window; it's a native bridge between your hardware and your home. High-performance, OS-integrated, and wrapped in a stunning glassmorphism shell.

---

## 🕹️ Interactive Feature Explorer
*Click on a feature to deep dive into the technical details.*

<details>
<summary><b>🚀 Performance & Smart Connectivity</b></summary>
<br>
Built on a custom Electron engine, the app ensures your dashboard is always accessible and responsive.
<ul>
  <li><b>Smart Connect</b>: Automatically fails over between your <b>Local URL</b> (high-speed Wi-Fi) and <b>Remote URL</b> (Nabu Casa/VPN) when you leave home.</li>
  <li><b>Deep Linking</b>: Open specific dashboards via <code>ha-desktop://dashboard/name</code> from other apps or shortcuts.</li>
  <li><b>Picture-in-Picture (PiP)</b>: Pop camera feeds or dashboards into a floating, always-on-top window.</li>
</ul>
</details>

<details>
<summary><b>🛰️ Pro-Grade OS Telemetry</b></summary>
<br>
The app turns your desktop into a rich Home Assistant device with industry-leading OS awareness.
<ul>
  <li><b>Mic & Camera Detection</b>: Report when your hardware is in use (perfect for "In a Meeting" automations).</li>
  <li><b>Do Not Disturb Sync</b>: Synchronize your OS Focus Mode/DND state with Home Assistant.</li>
  <li><b>Active App Tracking</b>: Reports which application is currently in focus (Productivity sensor).</li>
  <li><b>Advanced Battery</b>: Real-time reporting of percentage, charging status, and <b>estimated time remaining</b>.</li>
</ul>
</details>

<details>
<summary><b>🛡️ Native Integration & Security</b></summary>
<br>
Deeply integrated features that feel like a core part of your OS.
<ul>
  <li><b>Biometric Lock (macOS/Win)</b>: Secure your dashboard with TouchID or Windows Hello.</li>
  <li><b>Dark Mode Sync</b>: Auto-switches HA themes to match your OS light/dark settings.</li>
  <li><b>Media Keys</b>: Control HA media players using your keyboard's physical media buttons.</li>
  <li><b>System Tray</b>: Seamless background operation and quick settings access.</li>
</ul>
</details>

<details>
<summary><b>🛠️ Power User Tools</b></summary>
<br>
Customize the desktop experience to your exact needs.
<ul>
  <li><b>Custom CSS Injection</b>: Inject your own styles to hide headers or tweak the HA look.</li>
  <li><b>Startup Scripts</b>: Run local terminal commands automatically when the app launches.</li>
  <li><b>Auto-Update</b>: Configurable background updates to keep you on the latest version.</li>
</ul>
</details>

---

## 🛠️ Setup Checklist
*Follow these steps to get running in under 60 seconds.*

- [ ] **1. Install the App** (Select your OS below)
- [ ] **2. Link your HA URL** (Local, Nabu Casa, or DuckDNS)
- [ ] **3. Configure API Access** (Generate a Long-Lived Token)
- [ ] **4. Enable Background Mode** (Toggle in Preferences)

---

## 📦 One-Click Installation

<table width="100%">
  <tr>
    <td width="33%" align="center">
      <b>🪟 Windows</b><br>
      <a href="https://github.com/nexos20lv/Home-Assistant-Desktop/releases">Download .exe</a>
    </td>
    <td width="33%" align="center">
      <b>🍎 macOS</b><br>
      <a href="https://github.com/nexos20lv/Home-Assistant-Desktop/releases">Download .dmg</a>
    </td>
    <td width="33%" align="center">
      <b>🐧 Linux</b><br>
      <a href="https://github.com/nexos20lv/Home-Assistant-Desktop/releases">Download .deb</a>
    </td>
  </tr>
</table>

<details>
<summary><b>⚠️ Fix macOS "App is damaged" error</b></summary>
<br>
If you cannot open the app after moving it to Applications, run this in your Terminal:
<code>xattr -d com.apple.quarantine "/Applications/Home Assistant Desktop.app"</code>
</details>

---

## ☕ Support the Evolution

Maintaining a premium open-source project requires time and passion. If this app adds value to your life, consider supporting its development.

<p align="center">
  <a href="https://buymeacoffee.com/nexos20">
    <img src="https://img.shields.io/badge/Buy_Me_A_Coffee-Support_Development-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Support">
  </a>
</p>

---

---

## 💬 Community Feedback & FAQ

**Q: Can I disable automatic updates?**
**A:** Yes! Go to **Tray Icon > Preferences** and toggle **Auto-Updates** off. 

**Q: Does it support notifications?**
**A:** Fully. The app natively handles Home Assistant notification requests and displays them using your OS's notification system.

**Q: Can I open camera popups in a separate window?**
**A:** Yes! The app now automatically detects internal Home Assistant links and opens them in a native standalone window for better multitasking.

---

## 💻 Development & Build

```bash
# 1. Clone
git clone https://github.com/nexos20lv/Home-Assistant-Desktop.git

# 2. Boot
npm install && npm start

# 3. Build Production
npm run make
```

*Crafted with ❤️ by [NeXoS_20](https://github.com/nexos20lv). Licensed under MIT.*
*
