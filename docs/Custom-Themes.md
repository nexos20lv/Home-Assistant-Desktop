# 🎨 Custom Themes & Styling Guide

Personalize your **Home Assistant Desktop** experience in seconds! This guide shows you how to customize the native shell top bar and inject custom CSS into your Home Assistant dashboard with zero coding experience required.

---

## 🚀 Quick Start: 2 Ways to Customize

You can customize two distinct layers of the app:

1. **Native Shell Theme** (The top window bar, title overlay, and controls).
2. **Dashboard Custom CSS** (The Home Assistant dashboard, cards, headers, and colors).

---

## 🪟 1. Native Shell Themes (Top Bar)

Choose from pre-built native window themes directly in **Preferences**:

1. Open **Preferences** (Click the ⚙️ Gear icon in the top bar or press `Ctrl+Alt+H`).
2. Scroll to **Shell Theme & Glassmorphism**.
3. Select your favorite style:
   - ❄️ **Frosted Glass (Vibrancy / Acrylic):** Native translucent glassmorphism effect (macOS Vibrancy / Windows 11 Acrylic).
   - 🌑 **OLED Pure Black:** Pitch-black background (`#000000`) for OLED displays.
   - 🌙 **Dark Mode:** Deep slate dark theme (`#0f172a`).
   - ☀️ **Light Mode:** Crisp, high-contrast light theme.
4. Click **Save** — the theme applies instantly!

---

## 🎨 2. Dashboard Custom CSS Templates (Copy & Paste)

You can inject custom CSS directly into your Home Assistant dashboard without modifying any Home Assistant files on your server.

### How to Apply a Template:
1. Open **Preferences** → Go to **Advanced** tab.
2. Paste any code block below into the **Custom CSS** field.
3. Click **Save**.

---

### 🌟 Template 1: Frosted Glassmorphism
*Turns all Home Assistant cards into modern semi-transparent glass cards with subtle neon borders.*

```css
/* Glassmorphism Cards */
ha-card {
    background: rgba(15, 23, 42, 0.65) !important;
    backdrop-filter: blur(16px) saturate(180%) !important;
    -webkit-backdrop-filter: blur(16px) saturate(180%) !important;
    border: 1px solid rgba(255, 255, 255, 0.12) !important;
    border-radius: 16px !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
}

/* Subtle Card Hover Effect */
ha-card:hover {
    border-color: rgba(56, 189, 248, 0.4) !important;
    transform: translateY(-2px);
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
```

---

### 🌑 Template 2: Ultra OLED Midnight Black
*Saves power on OLED screens by forcing true pitch-black backgrounds.*

```css
/* Pure OLED Background */
body, home-assistant, hui-view, page-ha-lovelace {
    background-color: #000000 !important;
}

/* High Contrast OLED Cards */
ha-card {
    background-color: #050505 !important;
    border: 1px solid #1f1f1f !important;
    border-radius: 12px !important;
}
```

---

### 📺 Template 3: Kiosk / Clean View Mode
*Hides the default Home Assistant top header and sidebar for a distraction-free display.*

```css
/* Hide Home Assistant Top Header */
#drawer-toggle,
app-header,
.header {
    display: none !important;
}

/* Remove Top Padding */
ha-app-layout {
    padding-top: 0 !important;
}
```

---

### 🔤 Template 4: Modern Inter Typography
*Replaces default fonts with clean, crisp modern typography.*

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

body, home-assistant, ha-card, .card-header {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
}
```

---

## 💡 Combining Themes

You can freely mix and match CSS snippets! Simply stack them together in the **Custom CSS** text box in Preferences.

```css
/* Example: Glassmorphism + Hide Header */
#drawer-toggle, app-header { display: none !important; }

ha-card {
    background: rgba(15, 23, 42, 0.7) !important;
    backdrop-filter: blur(12px) !important;
    border-radius: 16px !important;
}
```

Enjoy your customized Home Assistant Desktop experience! 🚀
