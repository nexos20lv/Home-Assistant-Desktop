# Power User Tools

---

## Startup Dashboard Path

Open a specific Lovelace view instead of the default dashboard on every launch.

**Preferences → General → Connection → Startup Dashboard Path**

| Example path | What opens |
|---|---|
| *(empty)* | HA default dashboard |
| `/lovelace/home` | Your "home" Lovelace view |
| `/lovelace/0` | First dashboard by index |
| `/energy` | Energy dashboard |
| `/history` | History panel |
| `/_my_redirect/profile` | HA profile page |

The path is appended to the active HA URL (local or remote), so Smart Connect still applies.

---

## Custom CSS Injection

**Preferences → Advanced → Custom CSS**

The CSS you write here is injected into every HA page after it loads, including after SPA navigation. Common uses:

### Hide the HA top navigation bar

```css
.header, header {
  display: none !important;
}
app-toolbar {
  display: none !important;
}
```

### Change the HA font

```css
body, ha-card {
  font-family: "Inter", sans-serif !important;
}
```

### Increase card padding for large monitors

```css
ha-card {
  padding: 20px !important;
}
```

### Dark background for sidepanel

```css
home-assistant-main {
  --sidebar-background-color: #0c111d !important;
}
```

CSS is re-applied on every page load, including after the app reconnects to a new server.

---

## Startup Scripts

**Preferences → Advanced → Startup Scripts**

Run local shell commands automatically when the app launches. One command per line, maximum 20 lines.

**Safe Mode** (enabled by default) shows a confirmation dialog listing all commands before they run. Disable it only for fully trusted, read-only commands.

### Example: Wake on LAN

```
wakeonlan AA:BB:CC:DD:EE:FF
```

### Example: Mount a NAS share (macOS)

```
mount -t smbfs //user@nas/share /Volumes/NAS
```

### Example: Start a Python script

```
python3 /home/user/scripts/sync.py
```

### Security

Commands are executed with the same permissions as the app (your user account). The app validates that commands are not injecting control characters and limits execution to 20 entries. Always leave Safe Mode enabled if scripts were not written by you.

---

## Picture-in-Picture (PiP)

Click the **PiP button** in the title bar (or use the shell button) to open the current HA page in a **floating 320×180 window** that stays on top of all other windows.

Use cases:
- Keep a camera feed visible while working
- Monitor an energy panel during a long render
- Show a music player card while coding

The PiP window shares the same HA session (same login cookies), so it loads instantly without re-authentication.

---

## Deep Linking

Open a specific HA page from any external source using the `ha-desktop://` URL scheme.

### Format

```
ha-desktop://<path>
```

The `<path>` is appended to the current active server URL. It must be on the same HA origin — cross-origin paths are rejected for security.

### Examples

| Deep link | Opens |
|---|---|
| `ha-desktop:///lovelace/home` | Home dashboard |
| `ha-desktop:///config/integrations` | Integrations page |
| `ha-desktop:///history?entity_id=sensor.temperature` | Entity history |

### Registering on Windows

The app registers itself as the `ha-desktop://` protocol handler on first launch. To trigger a deep link from a script:

```powershell
Start-Process "ha-desktop:///lovelace/home"
```

### Registering on macOS

The handler is registered via the app's Info.plist. To trigger from Terminal:

```sh
open "ha-desktop:///lovelace/home"
```

### Registering on Linux

```sh
xdg-open "ha-desktop:///lovelace/home"
```

---

## Media Keys

Keyboard media keys (Play/Pause, Next, Previous) are captured globally and forwarded to the HA media player entity you configure.

**Preferences → Sensors → Default Media Player** — set the entity ID (e.g. `media_player.living_room`).

The app calls:
- `media_player.media_play_pause`
- `media_player.media_next_track`
- `media_player.media_previous_track`

Media key capture is active as long as the app is running, even when minimized to the tray.

---

## Global Keyboard Shortcut

**Preferences → General → Global Shortcut** — enable to register `Ctrl + Alt + H`.

Press it from any application to toggle the app window. Useful as a quick show/hide without touching the tray icon.

---

## Display Scale

**Preferences → General → Display Scale**

Scales the entire HA dashboard from 80 % (more content, smaller UI) to 110 % (larger text). Default is 100 %. Useful on 4K monitors or when using the PiP window.

Scale changes apply immediately without reloading the page.

---

## Biometric Lock

**Preferences → General → Biometric Lock**

When enabled, the app requests TouchID (macOS) or Windows Hello at launch before showing the window. If authentication fails, the app quits.

- Requires a device with a registered biometric (fingerprint sensor, Face ID, IR camera)
- On macOS, the app must have Accessibility access for `systemPreferences.promptTouchID()` to work
- Does not encrypt stored data — it only gates the UI

---

## Window State Persistence

The app remembers your window size, position, and maximized state across restarts. No configuration needed. Bounds are saved 500 ms after any resize or move with a debounce to avoid excessive disk writes.

On a multi-monitor setup, if the saved position is off-screen (e.g. after unplugging a monitor), Electron automatically re-centers the window.
