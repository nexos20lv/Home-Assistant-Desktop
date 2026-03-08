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
<summary><b>🚀 Performance & Zero-Latency</b></summary>
<br>
Built on a custom Electron 40+ engine, the app uses <b>BrowserViews</b> instead of iframes to ensure the UI remains responsive even when loading heavy dashboards.
<ul>
  <li><b>Single-Instance Lock</b>: Prevents resource drain from accidental double-launches.</li>
  <li><b>Partitioned Storage</b>: Keeps your HA session isolated and lightning-fast.</li>
</ul>
</details>

<details>
<summary><b>🛰️ Real-Time Hardware Telemetry</b></summary>
<br>
The app doesn't just display your dashboard; it turns your PC into a Home Assistant device.
<ul>
  <li><b>CPU usage</b>: <code>sensor.[hostname]_desktop_cpu_usage</code></li>
  <li><b>RAM usage</b>: <code>sensor.[hostname]_desktop_memory_usage</code></li>
  <li><b>Battery</b>: Reports charging status and level via native platform APIs (pmset/PowerShell).</li>
  <li><b>Unique ID</b>: Uses <code>node-machine-id</code> for stable hardware tracking.</li>
</ul>
</details>

<details>
<summary><b>🛡️ Security & OS Integration</b></summary>
<br>
Deeply integrated features for a native feel.
<ul>
  <li><b>Native Title Bar</b>: Uses <code>titleBarStyle: 'hidden'</code> with custom overlays for a seamless look.</li>
  <li><b>System Tray</b>: Background monitoring and quick-toggle shortcuts.</li>
  <li><b>Auto-Update</b>: Seamlessly powered by Squirrel (Win) and built-in update engine.</li>
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
