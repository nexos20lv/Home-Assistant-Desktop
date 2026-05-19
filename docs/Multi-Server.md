# Multi-Server Profiles

Home Assistant Desktop supports multiple HA instances — home, office, vacation house, test server — all manageable from one place. Switch between them instantly without touching any configuration file.

---

## Overview

Each **server profile** stores:
- A display name
- A local URL
- A remote URL (optional)
- Whether to force remote mode
- Whether Smart Connect is active for this server

The **active server** is the one loaded on launch and shown in the dashboard. All other settings (sensor reporting, display scale, CSS, etc.) are shared across servers.

---

## Managing servers

Open **Preferences → Servers**.

### Adding a server

1. Click **+ Add Server**.
2. Fill in the **name**, **local URL**, and optionally the **remote URL**.
3. Click the radio button on the left to make it the active server.
4. Click **Save Servers**.

### Editing a server

All fields are editable in-line — just type in the input boxes. Changes take effect after clicking **Save Servers**.

### Removing a server

Click **Remove** on the server card. If you remove the active server, the first remaining server becomes active automatically.

### Setting the active server

Click the radio button on the left of any server card, then **Save Servers**. The dashboard reloads to the selected server immediately.

---

## Switching from the tray

When more than one server is configured, the tray context menu shows a **Servers** submenu with a radio list. Click any server name to switch to it live — no app restart, no Preferences window.

```
Show App
─────────
Servers ▶  ● Home
            ○ Office
            ○ Test Server
─────────
Support the Project (☕)
Reset Configuration
─────────
Quit
```

---

## Migration from single-server setup

If you set up the app before multi-server was available, your existing `haUrl` and `remoteUrl` are automatically migrated into a single server profile named **"Home"** on first launch. Nothing is lost.

---

## Per-server API token

The API token is shared across all servers. If your servers use different accounts or different tokens, update the token in **Preferences → Sensors → Remote API Access Token** after switching servers.

A per-server token field is planned for a future release.

---

## Deep linking with multiple servers

Deep links (`ha-desktop://path`) always target the **currently active server**. If you need to target a specific server from an external shortcut, switch to it first via the tray, then trigger the deep link.
