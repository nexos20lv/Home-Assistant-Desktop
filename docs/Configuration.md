# Configuration

All settings live in **Preferences**, accessible from:

- **Tray icon** → right-click → Preferences  
- **Title bar** → gear icon  
- **Keyboard shortcut** → `Ctrl + ,` (Windows/Linux) or `Cmd + ,` (macOS)  
- **Right-click context menu** inside the dashboard

Preferences has five tabs: **General**, **Sensors**, **Advanced**, **Servers**, and **Translations**.

---

## General tab

### Connection section

| Setting | Description | Default |
|---|---|---|
| **Local Instance URL** | Primary HA address on your LAN (e.g. `http://192.168.1.5:8123`) | — |
| **Remote Instance URL** | External URL used when local is unreachable | — |
| **Use Remote URL** | Force the app to always use the remote address | Off |
| **Smart Connect v2** | Auto-detect the fastest reachable URL; see [Smart Connect](Smart-Connect.md) | On |
| **Startup Dashboard Path** | Relative path opened on launch (e.g. `/lovelace/home`). Leave blank for the default dashboard. | — |

> **Startup path example:** If your local URL is `http://homeassistant.local:8123` and you set the startup path to `/lovelace/living-room`, the app will open `http://homeassistant.local:8123/lovelace/living-room` on launch.

### System Behavior section

| Setting | Description | Default |
|---|---|---|
| **Language** | App UI language. Choices: EN, FR, ES, DE, IT, PT, NL | System locale |
| **Display Scale** | Zoom level of the HA dashboard (80 % – 110 %) | 100 % |
| **Launch on Startup** | Start the app when you log into Windows/macOS | Off |
| **Global Shortcut** | Enable `Ctrl + Alt + H` to toggle window visibility | Off |
| **Auto-Updates** | Receive silent updates in the background | On |
| **Biometric Lock** | Require TouchID (macOS) or Windows Hello before showing the window | Off |

---

## Sensors tab

See the dedicated [Desktop Sensors](Sensors.md) page for entity IDs, automation examples, and platform notes.

| Setting | Description | Default |
|---|---|---|
| **Remote API Access Token** | Long-Lived Access Token from HA Profile | — |
| **Default Media Player** | Entity ID targeted by keyboard media keys | `media_player.all` |
| **Mic/Camera Reporting** | Master toggle for microphone and camera sensors | On |
| **Microphone Sensor** | `binary_sensor.desktop_microphone` individually | On |
| **Camera Sensor** | `binary_sensor.desktop_camera` individually | On |
| **Active App Sensor** | Reports the foreground application name | On |
| **DND / Focus Sync** | Reports Do-Not-Disturb / Focus mode state | On |
| **Sensor Report Frequency** | 1 min / 5 min / 15 min | 1 min |
| **Power Saver Mode** | Reduces frequency on battery or prolonged idle | Off |

---

## Advanced tab

| Setting | Description |
|---|---|
| **Custom CSS** | CSS injected into the HA dashboard after every page load. Use it to hide the header, restyle cards, or change fonts. |
| **Startup Scripts** | Shell commands executed at launch (one per line, max 20). A safe-mode dialog confirms before running if Safe Mode is on. |
| **Startup Scripts Safe Mode** | Show a confirmation prompt with the full list before running scripts. Always leave this on unless you fully trust the scripts. |
| **Error Log** | Recent runtime log entries. Use **Export Logs** to save them as a text file for issue reports. |

---

## Servers tab

See the dedicated [Multi-Server Profiles](Multi-Server.md) page.

---

## Translations tab

Shows translation coverage for each supported language. The preview panel displays all translated keys for the selected language.

To add a new language or fix a translation, edit `src/locales/translations.json` and submit a pull request.

---

## Resetting the app

To go back to the setup wizard:

- **Tray icon** → Reset Configuration  
- **Disconnect button** (visible on `/config` and `/profile` pages inside HA)

This clears the stored URL and all server profiles. The app relaunches into the setup wizard.
