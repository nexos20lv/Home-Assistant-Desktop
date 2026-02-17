# User Guide - Home Assistant Desktop

Welcome to the future of smart home control on your PC. This guide covers everything from installation to advanced sensor configuration.

## Table of Contents
1.  [Getting Started](#getting-started)
2.  [Interface Overview](#interface-overview)
3.  [PC Sensors Integration](#pc-sensors-integration)
4.  [Shortcuts & Tricks](#shortcuts--tricks)
5.  [Troubleshooting](#troubleshooting)

---

## Getting Started

### 1. Connection
When you first launch the app, you will see the **Setup Screen**.
Enter your Home Assistant URL.
*   Example: `http://192.168.1.50:8123`
*   Example: `https://my-home.duckdns.org`

> **Note**: If using HTTPS, ensure your certificate is valid.

### 2. Login
Once connected, you will see your standard Home Assistant Login screen. Log in with your username and password. The app will remember your session.

---

## Interface Overview

### The Shell
Unlike a browser, this app uses a custom "Shell".
*   **Top Bar**: Contains window controls and the **Preferences (Gear)** icon.
*   **System Tray**: The app lives in your notification area (near the clock).
    *   **Click**: Shows/Hides the window.
    *   **Right-Click**: Opens the Context Menu (Show, Preferences, Reset, Quit).

### Minimizing
Clicking the **X** (Close) button usually **minimizes the app to the tray** instead of quitting it. This keeps your sensors running in the background. To fully quit, use the Tray Menu > Quit.

---

## PC Sensors Integration 🔋

This app can report your computer's health to Home Assistant.

### Step 1: Get a Token
1.  Open Home Assistant.
2.  Click on your **Profile** (User Icon) in the bottom left.
3.  Scroll to the bottom to **Long-Lived Access Tokens**.
4.  Click **Create Token**. Name it "Desktop App".
5.  **Copy the weird long string of characters.**

### Step 2: Configure App
1.  Open Home Assistant Desktop.
2.  Click the **Gear Icon** (Preferences).
3.  Paste the token into the **PC Sensor Integration** field.
4.  Click **Save**.

### Step 3: Verify in Home Assistant
Go to **Developer Tools > States** and look for:
*   `sensor.desktop_status` (Active, Idle)
*   `sensor.desktop_memory_usage` (RAM %)

You can now use these in automations! (e.g., Turn on lights when PC is Active).

---

## Shortcuts & Tricks

| Shortcut | Action |
| :--- | :--- |
| **Ctrl + Alt + H** | Boss Mode! Instantly hide/show the app. |
| **F5** | Reload the page (if stuck). |
| **Ctrl + R** | Reload the page. |
| **Right-Click Tray** | Access "Reset Configuration" if you changed your URL. |

---

## Troubleshooting

### "The app is stuck on a white screen"
*   Right-click the Tray Icon and select **Reload**.
*   Check your internet connection.

### "I want to change my Home Assistant URL"
*   Right-click the Tray Icon and select **Reset Configuration**. This will restart the app and bring you back to the Setup Screen.

### "Sensors are not updating"
*   Ensure the Token is correct in Preferences.
*   Check if your PC has network access to Home Assistant.
*   Restart the app.

---

**Need more help?** [Open an Issue on GitHub](https://github.com/nexos20lv/Home-Assistant-Desktop/issues).
