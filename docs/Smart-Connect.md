# Smart Connect

Smart Connect automatically selects the fastest reachable Home Assistant URL so the app works whether you are at home or away, without any manual switching.

---

## How it works

### WebSocket monitor (real-time)

When the app starts, it opens a persistent WebSocket connection to `/api/websocket` on your active HA URL. This connection:

- Performs the HA authentication handshake (`auth_required` → `auth` → `auth_ok`)
- Provides instant connection status (the pill in the title bar turns **Local**, **Remote**, or **Offline**)
- Reconnects automatically 8 seconds after any disconnection

### HTTP health-check (failover)

Every 5 minutes the app tests both URLs with an HTTP request to `/api/`. If the active URL fails and the other one succeeds, Smart Connect switches to it. A **2-minute cooldown** prevents flapping when you are on a slow or intermittent connection.

### Decision logic

```
if "Use Remote URL" is ON
    → always use Remote URL

else if Smart Connect is OFF
    → always use Local URL

else (Smart Connect ON)
    → test Local URL first
        if reachable  → use Local
        else test Remote URL
            if reachable  → use Remote
            else          → Offline
```

---

## Configuration

| Setting | Where | Description |
|---|---|---|
| **Local URL** | Preferences → General → Connection | Your LAN address, checked first |
| **Remote URL** | Preferences → General → Connection | Nabu Casa, DuckDNS, Cloudflare, etc. |
| **Use Remote URL** | Preferences → General → Connection | Skip local entirely |
| **Smart Connect v2** | Preferences → General → Connection | Enable/disable auto-failover |

---

## Status pill

The title bar shows a pill indicator with three states:

| Pill | Meaning |
|---|---|
| 🟢 **Local** | Connected via local URL |
| 🟡 **Remote** | Connected via remote URL (local was unreachable) |
| 🔴 **Offline** | Neither URL reachable |

---

## Recommended URL formats

| Type | Example |
|---|---|
| Local IP | `http://192.168.1.5:8123` |
| mDNS hostname | `http://homeassistant.local:8123` |
| Nabu Casa | `https://abc123.ui.nabu.casa` |
| DuckDNS | `https://myhome.duckdns.org` |
| Cloudflare Tunnel | `https://ha.yourdomain.com` |

The setup wizard auto-corrects missing `http://` prefixes and trailing slashes.

---

## Troubleshooting

**The pill shows Offline but HA is up**  
Check that the API token is valid — the health check authenticates with it. A wrong or expired token returns a 401 which the app treats as unreachable.

**The app is stuck on Remote when I'm home**  
The 2-minute cooldown may be active. Wait for it to expire, or open Preferences → Save to force an immediate re-evaluation.

**I want to always use the remote URL**  
Enable **Use Remote URL** in Preferences → General → Connection. Smart Connect is bypassed entirely.
