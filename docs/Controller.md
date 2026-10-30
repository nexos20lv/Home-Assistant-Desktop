# Controller (Gamepad) Navigation

Home Assistant Desktop can be driven entirely with a game controller. That's handy on Windows handhelds (ROG Ally, Xbox Ally, Legion Go, MSI Claw…), on a PC connected to a TV, or anywhere a mouse is out of reach.

A highlight ring shows which control is selected; the controller moves it around the dashboard, the sidebar, dialogs and menus.

---

## Button map

| Button | Action |
|---|---|
| **D-pad** / **left stick** | Move the highlight to the nearest control in that direction |
| **A** | Select, like a tap |
| **Hold A** | Home Assistant's *hold action*, usually **more info** |
| **X** | Hold action / more info |
| **B** | Back: closes the open dialog or menu, otherwise goes back a page |
| **Y** | Open **Assist** |
| **LB** / **RB** | Previous / next dashboard view (or the tabs of the current page) |
| **LT** / **RT** | Page up / page down |
| **Right stick** | Scroll |
| **Menu** (☰) | Jump to the sidebar; press again, or **B**, to go back to where you were |
| **View** (⧉) | Toggle full screen |

- **Sliders:** on a slider (for example a light's brightness in its more-info dialog), the D-pad along the slider adjusts it; the other direction moves on.
- **Text fields:** the D-pad keeps moving between controls. Type with a keyboard or the on-screen keyboard.
- **Touch and mouse** still work as usual. Touching the screen or moving the mouse hides the highlight; the next controller input brings it back where you left off.
- The first time a controller is used, the title bar shows a short button guide for a few seconds.

---

## Turning it on or off

**Preferences → General → Controller → Controller Navigation** (on by default).

The app only reacts to the controller while its window is in the foreground, so a controller used in a game or another app is never picked up.

## Full screen

Press **View** on the controller, or **F11** (**Ctrl+Cmd+F** on macOS), to hide the title bar and give Home Assistant the whole screen. Press it again to leave full screen.

---

## Requirements and tips

- **Controllers:** anything Chromium maps to the standard gamepad layout: Xbox and XInput controllers (including the built-in controllers of Windows handhelds), DualShock/DualSense, and most others.
- **Press a button first:** browsers hide controllers from pages until a button is pressed (a privacy measure), so the very first press after launching only wakes the controller up.
- **Handhelds with a "desktop mode":** if the controller moves the mouse pointer instead (for example Armoury Crate's Desktop control mode on ROG Ally devices), switch the handheld to its gamepad mode.
- **Steam:** if you launch the app through Steam, make sure Steam Input passes a gamepad to it rather than a keyboard/mouse layout.
- **Assist (Y)** uses Home Assistant's `a` keyboard shortcut, so it needs keyboard shortcuts enabled in your Home Assistant profile.

## Troubleshooting

| Symptom | What to check |
|---|---|
| Nothing happens | Controller Navigation is on in Preferences; the app window is in the foreground; press a button once to wake the controller |
| The controller moves the mouse pointer | The handheld or a tool such as Steam Input is mapping the controller to mouse/keyboard; switch it to gamepad mode |
| A control can't be reached | Some custom cards aren't keyboard-focusable, so they can't take focus. Touch still works; please [open an issue](https://github.com/nexos20lv/Home-Assistant-Desktop/issues) with a screenshot |

---

## How it works

For contributors; see also [Development](Development.md).

1. **Reading the controller.** The title-bar page (`shell.html`) loads `src/renderer/gamepad-input.js`, which polls the W3C Gamepad API. Being a local `file://` page, it works whatever URL Home Assistant is served from, and it keeps receiving gamepad data while the Home Assistant view has keyboard focus. It polls every frame while in use, 20 times a second otherwise, and not at all while the window is in the background or no controller is connected.
2. **Commands.** It turns button presses into commands (`navigate`, `select`, `back`, `tab`, `scroll`…) and sends them over the `gamepad-command` IPC channel. The main process validates them and ignores them unless the main window is focused and the setting is on.
3. **Navigation inside Home Assistant.** `src/renderer/gamepad-nav.js` is injected on first use with `webContents.executeJavaScriptInIsolatedWorld()` (world `1001`). It shares the page's DOM but not its JavaScript, so Home Assistant can neither see nor call it, and the view still has no preload. It walks open shadow roots and slots to find focusable controls, confines focus to an open dialog or menu, and picks the next control with a scoring similar to Chromium's spatial navigation.
4. **Trusted input.** Select (Enter or Space), Escape and slider arrows are sent as native key events with `webContents.sendInputEvent()`, so Home Assistant handles them exactly like a keyboard; scrolling is sent as wheel events.
