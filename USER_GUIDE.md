# Home Assistant Desktop - User Guide & Tutorial

Welcome to your new dedicated Home Assistant dashboard! This guide will help you get set up and make the most of the advanced features.

## 1. Initial Setup

1.  **Launch the App**: When you first start the app, you'll see a setup screen.
2.  **Enter URL**: Type the address of your Home Assistant instance.
    *   *Example*: `http://192.168.1.50:8123` or `https://my-ha.duckdns.org`.
3.  **Connect**: Click connect. The app will save this URL.

## 2. Linking Your PC (Sensor Integration)

To let your PC report its status (Active/Idle, Battery) to Home Assistant, you need an API Token.

### Step A: Get the Token from Home Assistant
1.  Open Home Assistant (in the app or browser).
2.  Click on your **User Profile** (your initials/picture at the bottom left of the sidebar).
3.  Scroll down to the **Security** section.
4.  Find **Long-Lived Access Tokens** and click **Create Token**.
5.  Name it "Desktop App" and click OK.
6.  **COPY THIS TOKEN IMMEDIATELY**. You won't see it again.

### Step B: Configure the App
1.  In Home Assistant Desktop, click the **Gear Icon** (Preferences) in the top right title bar.
2.  Paste the token into the **API Token** field.
3.  Click **Save Changes**.

🎉 **Done!** You should now see two new sensors in Home Assistant:
*   `sensor.desktop_status`: Shows "Active" when the app is running.
*   `sensor.desktop_battery`: Shows battery percentage (if applicable).

## 3. Usage Tips

*   **System Tray**: When you close the window (X), the app **does not quit**. It minimizes to the tray (bottom right icons). Click the icon to bring it back.
*   **Quit**: To fully close the app, right-click the tray icon and select **Quit**.
*   **Shortcut**: Press `Ctrl + Alt + H` anywhere in Windows to instantly show/hide your dashboard.
*   **Quick Reload**: Right-click the app icon in your taskbar and select **Reload** if the dashboard freezes.
