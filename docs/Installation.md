# Installation

## System requirements

| | Minimum |
|---|---|
| **OS** | Windows 10 (64-bit), macOS 12 Monterey, Ubuntu 20.04 / Debian 11 |
| **RAM** | 512 MB available |
| **Disk** | 250 MB |
| **Network** | Local or remote access to a Home Assistant instance |

---

## Windows

1. Go to the [Releases page](https://github.com/nexos20lv/Home-Assistant-Desktop/releases/latest).
2. Download `Home-Assistant-Desktop-Setup-x.x.x.exe`.
3. Run the installer — no admin rights required (installs per-user).
4. The app launches automatically and places an icon in the system tray.

**Auto-updates** are enabled by default via Squirrel. The app silently updates itself in the background and restarts when a new version is available.

### Windows Defender SmartScreen

If you see a "Windows protected your PC" prompt, click **More info → Run anyway**. The binary is unsigned (open-source project); the source code is fully auditable on GitHub.

---

## macOS

1. Download `Home-Assistant-Desktop-x.x.x.dmg` from the Releases page.
2. Open the `.dmg`, drag the app to **Applications**.
3. Launch from Launchpad or Spotlight.

### "App is damaged" / Gatekeeper error

Because the app is not notarized with an Apple Developer certificate, macOS quarantines it. Remove the quarantine flag once after install:

```sh
xattr -d com.apple.quarantine "/Applications/Home Assistant Desktop.app"
```

Then launch normally from Finder.

### macOS 26 (Tahoe) note

macOS 26 is a developer beta. Electron 40 is not yet validated against it. If you experience crashes on Tahoe, please [open an issue](https://github.com/nexos20lv/Home-Assistant-Desktop/issues) with the crash report.

---

## Linux

### Debian / Ubuntu (.deb)

```sh
wget https://github.com/nexos20lv/Home-Assistant-Desktop/releases/latest/download/home-assistant-desktop_x.x.x_amd64.deb
sudo dpkg -i home-assistant-desktop_x.x.x_amd64.deb
home-assistant-desktop
```

### Fedora / RHEL (.rpm)

```sh
sudo rpm -i home-assistant-desktop-x.x.x.x86_64.rpm
home-assistant-desktop
```

### Wayland

The app enables native Wayland window decorations automatically on Linux (`ozone-platform-hint=auto`). No extra flags or environment variables are needed. It falls back to XWayland if your compositor does not support the protocol.

---

## First launch

After install the **Setup Wizard** opens automatically. It walks you through three steps:

1. **Local URL** — your HA address on your home network (e.g. `http://homeassistant.local:8123` or `http://192.168.1.5:8123`). The wizard validates the URL and auto-corrects common mistakes (missing protocol, trailing slash).

2. **Remote URL** *(optional)* — your external address for when you're away from home. Nabu Casa (`https://xyz.ui.nabu.casa`), DuckDNS, Cloudflare Tunnel, and any other HTTPS endpoint all work.

3. **API Token** *(optional)* — a Long-Lived Access Token from your HA profile page. Required only for [Desktop Sensors](Sensors.md). You can add or change it later in Preferences.

Click **Finish** and the main window loads your Home Assistant dashboard.

---

## Uninstall

- **Windows**: Settings → Apps → Home Assistant Desktop → Uninstall  
- **macOS**: Drag `/Applications/Home Assistant Desktop.app` to Trash  
- **Linux (.deb)**: `sudo dpkg -r home-assistant-desktop`  
- **Linux (.rpm)**: `sudo rpm -e home-assistant-desktop`

Stored data (URL, token, window position) lives in the Electron user-data directory:

| OS | Path |
|---|---|
| Windows | `%APPDATA%\home-assistant-desktop` |
| macOS | `~/Library/Application Support/home-assistant-desktop` |
| Linux | `~/.config/home-assistant-desktop` |

Delete that folder to fully reset the app to factory state.
