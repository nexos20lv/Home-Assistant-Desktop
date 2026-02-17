# Home Assistant Desktop

![Build Status](https://github.com/nexos20lv/Home-Assistant-Desktop/actions/workflows/release.yml/badge.svg)
![Version](https://img.shields.io/github/v/release/nexos20lv/Home-Assistant-Desktop?include_prereleases)
![License](https://img.shields.io/github/license/nexos20lv/Home-Assistant-Desktop)
![Downloads](https://img.shields.io/github/downloads/nexos20lv/Home-Assistant-Desktop/total)

**The futuristic, dedicated desktop client for Home Assistant.**

---

## 🚀 Features

| Feature | Description |
| :--- | :--- |
| **🎨 Futuristic Design** | Glassmorphism UI, custom title bar, and smooth animations. |
| **🖥️ Native Experience** | Runs independent of your browser. dedicated instance. |
| **⚡ Performance** | optimized Electron build with hardware acceleration. |
| **🖱️ System Tray** | Minimizes to tray for instant access. Background operation. |
| **⌨️ Global Shortcuts** | Toggle the app instantly with `Ctrl + Alt + H`. |
| **🔄 Auto-Updates** | Standard seamless updates in the background. |
| **🔌 PC Sensors** | Reports your PC's **CPU**, **RAM**, **Battery**, and **Uptime** directly to Home Assistant. |

## 📥 Installation

### Windows
1.  Download the latest installer (`.exe`) from the [Releases Page](https://github.com/nexos20lv/Home-Assistant-Desktop/releases).
2.  Run the installer. The app will launch automatically.
3.  Right-click the tray icon to access **Preferences** or **Quit**.

### macOS
1.  Download the Disk Image (`.dmg`) from Releases.
2.  Drag the app to your Applications folder.

### Linux
1.  Download the `.deb` or `.rpm` package.
2.  Install via your package manager (e.g., `sudo dpkg -i home-assistant-desktop_*.deb`).

---

## ⚙️ Configuration

### Initial Setup
On first launch, you will be asked for your **Home Assistant URL**.
- **Local**: `http://homeassistant.local:8123`
- **Remote**: `https://your-ha-instance.ui.nabu.casa`

### Preferences
Access the Preferences via the **System Tray Icon** (Right Click -> Preferences) or the gear icon in the title bar.

*   **Launch on Startup**: Automatically start minimized.
*   **Global Shortcut**: Enable/Disable `Ctrl + Alt + H`.
*   **PC Sensors**: Enter your "Long-Lived Access Token" to enable sensor reporting.

## 🛠️ Development

```bash
# Clone the repository
git clone https://github.com/nexos20lv/Home-Assistant-Desktop.git

# Install dependencies
npm install

# Run in development mode
npm start

# Build for production
npm run make
```

## 🤝 Contributing

Contributions are welcome! Please fork the repository and open a Pull Request.

## 📄 License

MIT © [NeXoS_20](https://github.com/nexos20lv)
