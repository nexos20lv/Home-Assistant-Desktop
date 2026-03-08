# 🏠 Home Assistant Desktop

[![Build Status](https://github.com/nexos20lv/Home-Assistant-Desktop/actions/workflows/release.yml/badge.svg)](https://github.com/nexos20lv/Home-Assistant-Desktop/actions)
[![Version](https://img.shields.io/github/v/release/nexos20lv/Home-Assistant-Desktop?include_prereleases)](https://github.com/nexos20lv/Home-Assistant-Desktop/releases)
[![License](https://img.shields.io/github/license/nexos20lv/Home-Assistant-Desktop)](https://github.com/nexos20lv/Home-Assistant-Desktop/blob/main/LICENSE)
[![Downloads](https://img.shields.io/github/downloads/nexos20lv/Home-Assistant-Desktop/total)](https://github.com/nexos20lv/Home-Assistant-Desktop/releases)

**Home Assistant Desktop** is a premium, dedicated desktop client for [Home Assistant](https://www.home-assistant.io/). Built with Electron, it provide a native, high-performance experience that's completely independent of your browser, featuring a futuristic glassmorphism UI and deep system integration.

---

## ✨ Features

### 🖥️ Native Experience
- **Dedicated Instance**: No more searching through browser tabs. Home Assistant now lives as a first-class application on your desktop.
- **Custom Title Bar**: A sleek, minimal title bar that blends perfectly with the Home Assistant dashboard.
- **System Tray Integration**: Minimize the app to the tray to keep it running in the background without cluttering your taskbar.

### 🔌 Real-Time PC Sensors
Monitor your computer's health directly from your Home Assistant dashboards. The app automatically reports the following sensors:
- **📊 CPU Usage**: Real-time percentage of processor load.
- **🧠 Memory Usage**: Current RAM consumption and percentage.
- **🔋 Battery Status**: Level and charging status (Supported on **Windows, macOS, and Linux**).
- **⏱️ Uptime**: Standalone sensor tracking how long your system has been running.
- **🛡️ Status**: Heartbeat sensor to monitor the connection state.

### ⌨️ Productivity & UI
- **Global Shortcut**: Press `Ctrl + Alt + H` (or `Cmd + Alt + H` on Mac) to toggle the window visibility instantly from anywhere.
- **Glassmorphism Design**: A modern, transparent UI that feels premium and integrated.
- **Auto-Updates**: Never worry about versions; the app updates itself seamlessly in the background.

---

## 📥 Installation

### Windows
1.  Download the latest `.exe` installer from the [Releases Page](https://github.com/nexos20lv/Home-Assistant-Desktop/releases).
2.  Run the setup. The application will install and launch automatically.
3.  A desktop shortcut and start menu entry will be created.

### macOS
1.  Download the `.dmg` file from the [Releases Page](https://github.com/nexos20lv/Home-Assistant-Desktop/releases).
2.  Open the Disk Image and drag **Home Assistant Desktop** to your **Applications** folder.
3.  Launch it from your Applications or via Spotlight.

### Linux
1.  Download the appropriate package (`.deb` for Debian/Ubuntu, `.rpm` for Fedora/RHEL) from [Releases](https://github.com/nexos20lv/Home-Assistant-Desktop/releases).
2.  Install via your terminal:
    ```bash
    # Debian/Ubuntu
    sudo dpkg -i home-assistant-desktop_*.deb
    # Fedora/RHEL
    sudo rpm -i home-assistant-desktop_*.rpm
    ```

---

## ⚙️ Configuration & Setup

### 1. Connecting to Home Assistant
On your first launch, you'll be greeted with a setup screen:
- **URL**: Enter your Home Assistant instance URL (e.g., `http://homeassistant.local:8123` or your Nabu Casa remote URL).
- The app uses a persistent session, so you'll only need to log in once.

### 2. Enabling Sensors
To enable the PC sensor reporting, you need to provide a **Long-Lived Access Token**:
1.  Go to your Home Assistant Profile (click your name in the bottom left).
2.  Scroll down to **Long-Lived Access Tokens**.
3.  Click **Create Token**, give it a name (e.g., "Desktop App"), and copy the generated token.
4.  In the Desktop App, right-click the Tray icon -> **Preferences**.
5.  Paste the token into the **API Token** field and save.

### 3. Preferences Explained
- **Launch on Startup**: If enabled, the app will start automatically when you log into your computer and sit quietly in the tray.
- **Global Shortcut**: Toggle the visibility of the app with a system-wide hotkey.
- **Reset Configuration**: Clears your saved URL and Token and restarts the app.

---

## 🛠️ Technical Details

### Sensor Architecture
The app communicates with Home Assistant via its [REST API](https://developers.home-assistant.io/docs/api/rest/). Sensors are updated every **60 seconds**.
- **macOS**: Battery info is retrieved using the `pmset` utility.
- **Windows**: Battery info is retrieved via PowerShell `Win32_Battery` CIM instance.
- **Linux**: Data is read directly from `/sys/class/power_supply/`.
- **Unique IDs**: Each sensor is registered with a unique ID based on your machine's hardware ID (`node-machine-id`), preventing conflicts if you use the app on multiple computers.

---

## ☕ Support the Project

If you find this project useful and would like to support its development, you can buy me a coffee! Your support helps keep the project active and motivated.

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Donate-orange?style=for-the-badge&logo=buy-me-a-coffee&logoColor=white)](https://buymeacoffee.com/nexos20)

---

## 👨‍💻 Development

Want to contribute or build from source?

```bash
# 1. Clone the repository
git clone https://github.com/nexos20lv/Home-Assistant-Desktop.git

# 2. Install Dependencies
npm install

# 3. Run in Dev Mode
npm start

# 4. Package for Production
npm run make
```

---

## 🤝 Contributing & Support

- **Bugs/Features**: Please open an [Issue](https://github.com/nexos20lv/Home-Assistant-Desktop/issues) for any bugs or feature requests.
- **Pull Requests**: Contributions are very welcome! Please follow the existing code style.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Developed with ❤️ by [NeXoS_20](https://github.com/nexos20lv).
