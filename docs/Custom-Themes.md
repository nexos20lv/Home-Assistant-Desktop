# 🎨 Custom Themes & Themes Directory System

Personalize your **Home Assistant Desktop** experience in seconds! The app features a dynamic **Theme Directory Scanner Engine** that automatically detects all `.css` theme files from both built-in themes and your local custom themes folder.

---

## 📂 How the Themes Engine Works

The app automatically scans two directories for `.css` theme files on launch:

1. **Built-in Themes Directory (`src/themes/`)**: Included out-of-the-box with the app.
2. **User Custom Themes Directory (`~/.config/home-assistant-desktop/themes/` or `%APPDATA%/home-assistant-desktop/themes/`)**: Your personal folder where you can drop any `.css` file!

---

## 🎨 Applying or Dropping Custom Themes

### Method 1: Use Scanned Theme Presets
1. Open **Preferences** (Click ⚙️ or press `Ctrl+Alt+H`).
2. Go to **Advanced** → **Dashboard CSS & Theme Presets**.
3. Select any theme from the **Select a Scanned Theme Preset** dropdown.
4. Click **Save** — the style is injected into your Home Assistant dashboard!

---

### Method 2: Drop Your Own `.css` Files (Folder Scanning)
1. Open **Preferences** → **Advanced**.
2. Click the **📂 Open Themes Folder** button.
3. Drop any custom `.css` file into the opened folder (e.g. `cyber-neon.css`).
4. Re-open Preferences — your new theme will automatically appear under **👤 Custom Themes** in the dropdown!

---

## 🛠️ Creating Your Own Custom Theme File

Create a file named `my-custom-theme.css` and optionally add a header title comment:

```css
/* Theme: My Awesome Neon Theme */

ha-card {
    background: rgba(18, 24, 38, 0.85) !important;
    border: 1px solid #00f0ff !important;
    border-radius: 12px !important;
    box-shadow: 0 0 12px rgba(0, 240, 255, 0.25) !important;
}

ha-card:hover {
    border-color: #ff007f !important;
    box-shadow: 0 0 18px rgba(255, 0, 127, 0.4) !important;
}
```

Save the file in your user `themes/` folder and it will be scanned instantly by Home Assistant Desktop!

---

## 📦 Built-in Themes Included

| File | Theme Name | Description |
|---|---|---|
| `frosted-glass.css` | 🎨 Frosted Glassmorphism | Translucent glass cards with backdrop blur & glowing hover effects |
| `oled-black.css` | 🎨 OLED Pure Black | Pitch black background (`#000000`) for OLED power savings |
| `kiosk-minimal.css` | 🎨 Kiosk Minimal Mode | Hides top header and sidebars for touchscreen / wall displays |
| `cyberpunk-neon.css` | 🎨 Cyberpunk Neon | Futuristic neon cyan & magenta glowing theme |
| `modern-inter.css` | 🎨 Modern Inter Typography | Replaces default fonts with clean Inter typography |

Enjoy your customized Home Assistant Desktop experience! 🚀
