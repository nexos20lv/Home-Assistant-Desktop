# Desktop Sensors

Home Assistant Desktop reports your computer's hardware and OS state to Home Assistant as native entities. You can use these in dashboards, automations, and scripts exactly like any other device.

---

## Prerequisites

1. Generate a **Long-Lived Access Token** in Home Assistant:
   - Open HA → click your username (bottom-left) → **Security** tab → **Long-lived access tokens** → **Create token**
   - Name it "Desktop App" and copy the token immediately (it is shown only once)
2. In the app: **Preferences → Sensors → Remote API Access Token** → paste the token → Save

The app registers sensors on first report using the HA REST API (`/api/states/<entity_id>`). No HACS integration or custom component is needed.

---

## Entity reference

### Hardware sensors

| Entity ID | Type | Unit | Platform |
|---|---|---|---|
| `sensor.desktop_cpu_usage` | sensor | % | All |
| `sensor.desktop_memory_usage` | sensor | % | All |
| `sensor.desktop_uptime` | sensor | hours | All |
| `sensor.desktop_battery_level` | sensor | % | All (laptops) |
| `sensor.desktop_battery_status` | sensor | — | All (laptops) |

**Battery status** values: `charging`, `discharging`, `unknown`.  
On desktops without a battery, the battery entities are not sent.

### Activity sensors

| Entity ID | Type | Platform |
|---|---|---|
| `sensor.desktop_status` | sensor | All |
| `sensor.desktop_active_app` | sensor | Windows, macOS |
| `binary_sensor.desktop_dnd` | binary_sensor | Windows, macOS |
| `binary_sensor.desktop_microphone` | binary_sensor | Windows, macOS |
| `binary_sensor.desktop_camera` | binary_sensor | Windows, macOS |

**Desktop status** values: `Active` (user input in the last 5 minutes), `Idle`.

---

## Platform coverage

| Feature | Windows | macOS | Linux |
|---|---|---|---|
| CPU / RAM / Uptime | ✅ | ✅ | ✅ |
| Battery | ✅ | ✅ | ✅ (via `/sys/class/power_supply`) |
| Active App | ✅ (via PowerShell) | ✅ (via AppleScript) | — |
| Do-Not-Disturb | ✅ (Focus Assist) | ✅ (Focus modes) | — |
| Mic / Camera | ✅ (via PowerShell) | ✅ (via lsof/AppleScript) | — |

---

## Report frequency and Power Saver Mode

Configure the report interval in **Preferences → Sensors → Sensor Report Frequency**:

| Setting | Interval |
|---|---|
| Every 1 minute | 60 s |
| Every 5 minutes | 300 s |
| Every 15 minutes | 900 s |

**Power Saver Mode** (Preferences → Sensors) automatically triples the effective interval when the system is on battery power or has been idle for more than 5 minutes. This reduces CPU wake-ups and extends laptop battery life.

---

## Automation examples

### Turn on a desk lamp when the PC becomes active

```yaml
automation:
  trigger:
    platform: state
    entity_id: sensor.desktop_status
    to: "Active"
  action:
    service: light.turn_on
    target:
      entity_id: light.desk_lamp
```

### Set scene to "Meeting" when mic goes active

```yaml
automation:
  trigger:
    platform: state
    entity_id: binary_sensor.desktop_microphone
    to: "on"
  action:
    service: scene.turn_on
    target:
      entity_id: scene.meeting_mode
```

### Notify phone when battery is low

```yaml
automation:
  trigger:
    platform: numeric_state
    entity_id: sensor.desktop_battery_level
    below: 20
  condition:
    condition: state
    entity_id: sensor.desktop_battery_status
    state: "discharging"
  action:
    service: notify.mobile_app_my_phone
    data:
      message: "Desktop battery at {{ states('sensor.desktop_battery_level') }}%"
```

### Pause media when DND turns on

```yaml
automation:
  trigger:
    platform: state
    entity_id: binary_sensor.desktop_dnd
    to: "on"
  action:
    service: media_player.media_pause
    target:
      entity_id: media_player.living_room_tv
```

---

## Delivery queue and retry

If a sensor update fails (network blip, HA restarting), the app queues up to **1000 failed reports** and retries them every 10 seconds. Reports older than the next report cycle are dropped to avoid stale data.

This means your HA states stay accurate even through brief connectivity gaps.

---

## Troubleshooting sensors

**Entities do not appear in HA**  
- Confirm the token is correct (a wrong token returns 401 silently)
- Check **Preferences → Advanced → Error Log** for `401` or `connection refused` entries
- Make sure the app can reach the HA REST API on the configured URL

**Sensors appear but stop updating**  
- Restart the app
- Check that the sensor interval is not set to 15 minutes by mistake
- If Power Saver Mode is on, values update less frequently on battery

**"desktop_active_app" shows nothing**  
Active App reporting requires permissions:  
- **macOS**: grant Accessibility access in System Settings → Privacy & Security → Accessibility  
- **Windows**: no extra permissions needed
