# Home Assistant Desktop

![Home Assistant Desktop Screenshot](screenshot.png) <!-- Conceptual placeholder -->

A premium, futuristic desktop client for Home Assistant built with Electron. Access your smart home directly from your PC with a dedicated, optimized application.

## 🚀 Features

*   **Dedicated Application**: Run Home Assistant outside of your browser.
*   **Premium UI**: A custom, minimalist window frame with a futuristic design.
*   **System Tray Integration**: Minimized app stays in the system tray for background access.
*   **Global Shortcut**: Toggle the app instantly with `Ctrl + Alt + H`.
*   **PC Sensors**: Report your PC's status (Active/Idle) and Battery key information back to Home Assistant for automations.
*   **Auto-Launch**: Option to start automatically on Windows logon.
*   **Zero Overlap**: Custom architecture ensures the title bar never obscures your dashboard.

## 🛠️ Installation

1.  Download the latest release from the [Releases Page](../../releases).
2.  Run the installer (`.exe`).
3.  Launch the app and enter your Home Assistant URL (e.g., `http://homeassistant.local:8123`).

## ⚙️ Configuration

*   **Preferences**: Click the gear icon in the title bar.
    *   **Launch on Startup**: Toggle auto-start.
    *   **Global Shortcut**: Enable/Disable `Ctrl + Alt + H`.
    *   **PC Sensor Integration**: Enter a clear Long-Lived Access Token to enable sensor reporting.

## ⌨️ Development

To build this application locally:

```bash
# Clone the repository
git clone https://github.com/yourusername/home-assistant-desktop.git

# Install dependencies
npm install

# Run in development mode
npm start

# Build for production
npm run make
```

## 🏗️ Architecture

Built with:
*   **Electron**: Core framework.
*   **Electron Builder**: Packaging and distribution.
*   **BrowserView**: For isolated, robust rendering of Home Assistant.

## 📄 License

MIT
