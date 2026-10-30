/*
 * Controller (gamepad) input.
 *
 * Loaded by shell.html, the title-bar page: a local file:// document that stays loaded for the
 * whole session, whatever Home Assistant URL is open, and keeps receiving gamepad data while the
 * Home Assistant view has keyboard focus. It turns the standard gamepad layout into commands for
 * the main process, which carries them out in the Home Assistant view (see gamepad-nav.js).
 *
 *   D-pad / left stick   move                   A      select (hold: more info)
 *   Right stick          scroll                 B      back
 *   LB / RB              previous / next view   X      more info
 *   LT / RT              page up / down         Y      Assist
 *   Menu                 sidebar                View   full screen
 */
(() => {
    'use strict';

    const api = window.electronAPI;
    if (!api || !api.sendGamepadCommand || typeof navigator.getGamepads !== 'function') return;

    // https://w3c.github.io/gamepad/#remapping
    const BUTTON = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
    const REPEAT_DELAY_MS = 400;
    const REPEAT_INTERVAL_MS = 110;
    const PAGE_REPEAT_MS = 350;
    const HOLD_MS = 500; // same as Home Assistant's long press
    const STICK_ON = 0.6;
    const STICK_OFF = 0.4;
    const TRIGGER_ON = 0.6;
    const TRIGGER_OFF = 0.35;
    const SCROLL_DEADZONE = 0.3; // radial; a resting stick can read up to ~0.27 (XInput's own figure)
    const SCROLL_SPEED = 2200; // px per second at full tilt
    const IDLE_POLL_MS = 33; // short enough to catch a quick tap
    const ACTIVE_MS = 1500; // poll every frame for this long after the last input

    let enabled = false;
    let focused = false;
    let frame = 0;
    let timer = 0;
    let previous = null;
    let nav = null;
    let stickDir = null;
    let aDownAt = 0;
    let aHeld = false;
    let scrollAt = 0;
    let scrollRest = { x: 0, y: 0 }; // sub-pixel scrolling carried over to the next frame
    let lastInputAt = 0;
    let listening = false;
    const triggers = { lt: { on: false, at: 0 }, rt: { on: false, at: 0 } };

    const send = (command) => {
        const now = performance.now();
        if (now - lastInputAt > 5000) window.dispatchEvent(new CustomEvent('gamepad-activity'));
        lastInputAt = now;
        api.sendGamepadCommand(command);
    };

    // Merges every standard-mapped pad, so it doesn't matter which one the OS lists first.
    const read = () => {
        const state = { connected: false, buttons: new Array(16).fill(false), lt: 0, rt: 0, lx: 0, ly: 0, rx: 0, ry: 0 };
        const stronger = (current, value) => (Math.abs(value) > Math.abs(current) ? value : current);
        for (const pad of navigator.getGamepads()) {
            if (!pad || !pad.connected || pad.mapping !== 'standard') continue;
            state.connected = true;
            pad.buttons.forEach((button, index) => {
                if (index < 16 && button.pressed) state.buttons[index] = true;
            });
            state.lt = Math.max(state.lt, pad.buttons[BUTTON.LT] ? pad.buttons[BUTTON.LT].value : 0);
            state.rt = Math.max(state.rt, pad.buttons[BUTTON.RT] ? pad.buttons[BUTTON.RT].value : 0);
            state.lx = stronger(state.lx, pad.axes[0] || 0);
            state.ly = stronger(state.ly, pad.axes[1] || 0);
            state.rx = stronger(state.rx, pad.axes[2] || 0);
            state.ry = stronger(state.ry, pad.axes[3] || 0);
        }
        return state;
    };

    const dpadDirection = (s) => {
        if (s.buttons[BUTTON.UP]) return 'up';
        if (s.buttons[BUTTON.DOWN]) return 'down';
        if (s.buttons[BUTTON.LEFT]) return 'left';
        if (s.buttons[BUTTON.RIGHT]) return 'right';
        return null;
    };

    // The left stick works like the D-pad, with hysteresis so it neither chatters nor flips axis
    // on diagonals.
    const stickDirection = (s) => {
        const ax = Math.abs(s.lx);
        const ay = Math.abs(s.ly);
        if (stickDir) {
            const horizontal = stickDir === 'left' || stickDir === 'right';
            const along = horizontal ? ax : ay;
            const across = horizontal ? ay : ax;
            if (along >= STICK_OFF && across < along * 1.5) return stickDir;
            stickDir = null;
        }
        if (Math.max(ax, ay) >= STICK_ON) stickDir = ax > ay ? (s.lx > 0 ? 'right' : 'left') : (s.ly > 0 ? 'down' : 'up');
        return stickDir;
    };

    // Takes a snapshot without acting on it, so buttons already held when polling (re)starts,
    // e.g. while switching back from a game, don't fire.
    const prime = (s, now) => {
        previous = s;
        const dir = dpadDirection(s) || stickDirection(s);
        nav = dir ? { dir, since: Infinity, last: now, primed: true } : null;
        aDownAt = 0;
        aHeld = false;
        scrollAt = 0;
        triggers.lt.on = s.lt >= TRIGGER_ON;
        triggers.lt.at = Infinity;
        triggers.rt.on = s.rt >= TRIGGER_ON;
        triggers.rt.at = Infinity;
    };

    const trigger = (t, value, delta, now) => {
        const on = value >= (t.on ? TRIGGER_OFF : TRIGGER_ON);
        if (on && (!t.on || now - t.at >= PAGE_REPEAT_MS)) {
            t.at = now;
            send({ type: 'page', delta });
        }
        t.on = on;
    };

    // Right stick: a radial dead zone, then speed growing with the square of the tilt for fine
    // control near the centre.
    const scroll = (s, now) => {
        const tilt = Math.min(1, Math.hypot(s.rx, s.ry));
        if (tilt < SCROLL_DEADZONE) {
            scrollAt = 0;
            scrollRest = { x: 0, y: 0 };
            return;
        }
        const elapsed = scrollAt ? now - scrollAt : 16;
        if (elapsed < 15) return; // about 60 messages a second, even on a 120 Hz display
        scrollAt = now;
        const t = (tilt - SCROLL_DEADZONE) / (1 - SCROLL_DEADZONE);
        const speed = SCROLL_SPEED * t * t * Math.min(elapsed, 50) / 1000;
        const x = scrollRest.x + (s.rx / tilt) * speed;
        const y = scrollRest.y + (s.ry / tilt) * speed;
        const dx = Math.trunc(x);
        const dy = Math.trunc(y);
        scrollRest = { x: x - dx, y: y - dy };
        if (dx || dy) send({ type: 'scroll', dx, dy });
    };

    const update = (s, now) => {
        const was = previous;
        previous = s;
        const pressed = (button) => s.buttons[button] && !was.buttons[button];
        const released = (button) => !s.buttons[button] && was.buttons[button];

        // The D-pad wins over the left stick. Neither moves while A is held, so a press always
        // lands on what was selected when A went down.
        const dir = aDownAt ? null : dpadDirection(s) || stickDirection(s);
        if (dir !== (nav ? nav.dir : null)) {
            if (nav && !nav.primed) send({ type: 'navigate', dir: nav.dir, phase: 'release' });
            nav = dir ? { dir, since: now, last: now } : null;
            if (dir) send({ type: 'navigate', dir, phase: 'press' });
        } else if (nav && now - nav.since >= REPEAT_DELAY_MS && now - nav.last >= REPEAT_INTERVAL_MS) {
            nav.last = now;
            send({ type: 'navigate', dir, phase: 'repeat' });
        }

        // A acts on release, like a tap; held long enough it becomes Home Assistant's hold action.
        if (pressed(BUTTON.A)) {
            aDownAt = now;
            aHeld = false;
            send({ type: 'press' });
        } else if (aDownAt && !aHeld && s.buttons[BUTTON.A] && now - aDownAt >= HOLD_MS) {
            aHeld = true;
            send({ type: 'hold' });
        } else if (aDownAt && released(BUTTON.A)) {
            send({ type: aHeld ? 'release' : 'select' });
            aDownAt = 0;
        }

        if (pressed(BUTTON.B)) send({ type: 'back' });
        if (pressed(BUTTON.X)) send({ type: 'hold' });
        if (pressed(BUTTON.Y)) send({ type: 'assist' });
        if (pressed(BUTTON.LB)) send({ type: 'tab', delta: -1 });
        if (pressed(BUTTON.RB)) send({ type: 'tab', delta: 1 });
        if (pressed(BUTTON.MENU)) send({ type: 'menu' });
        if (pressed(BUTTON.VIEW)) send({ type: 'fullscreen' });
        trigger(triggers.lt, s.lt, -1, now);
        trigger(triggers.rt, s.rt, 1, now);
        scroll(s, now);
    };

    // Every frame while in use, 20 times a second otherwise; nothing at all without a controller,
    // while the window is in the background, or when the feature is off.
    const tick = () => {
        frame = 0;
        timer = 0;
        if (!enabled || !focused || document.visibilityState !== 'visible') {
            previous = null;
            return;
        }
        const s = read();
        if (!s.connected) {
            releaseHeld();
            previous = null;
            return; // resumes on gamepadconnected
        }
        const now = performance.now();
        if (previous) update(s, now);
        else prime(s, now);
        const busy = nav || aDownAt || triggers.lt.on || triggers.rt.on || scrollAt || now - lastInputAt < ACTIVE_MS;
        if (busy) frame = requestAnimationFrame(tick);
        else timer = setTimeout(tick, IDLE_POLL_MS);
    };

    const start = () => {
        if (!frame && !timer) tick();
    };

    // Lets go of a direction or A press still in progress, so nothing stays held in the page.
    // Main accepts these even after the window has lost focus.
    function releaseHeld() {
        if (nav && !nav.primed) api.sendGamepadCommand({ type: 'navigate', dir: nav.dir, phase: 'release' });
        if (aDownAt) api.sendGamepadCommand({ type: 'release' });
        nav = null;
        aDownAt = 0;
        aHeld = false;
    }

    const stop = () => {
        releaseHeld();
        cancelAnimationFrame(frame);
        clearTimeout(timer);
        frame = 0;
        timer = 0;
        previous = null;
        stickDir = null;
    };

    const onConnected = () => start();
    const onDisconnected = () => {
        if (!Array.from(navigator.getGamepads()).some((pad) => pad && pad.connected)) {
            window.dispatchEvent(new CustomEvent('gamepad-idle'));
        }
    };

    // Watching the gamepad makes Chromium poll the controllers every few milliseconds, so only
    // watch while the feature is on and the window is in front. Watching also opts this page into
    // the browser's first-button-press unlock, which then lasts for the session.
    const listen = (on) => {
        if (on === listening) return;
        listening = on;
        const method = on ? 'addEventListener' : 'removeEventListener';
        window[method]('gamepadconnected', onConnected);
        window[method]('gamepaddisconnected', onDisconnected);
    };

    document.addEventListener('visibilitychange', start);

    api.onGamepadState((state) => {
        enabled = !!(state && state.enabled);
        focused = !!(state && state.focused);
        listen(enabled && focused);
        if (enabled && focused) start();
        else stop();
        if (!enabled) window.dispatchEvent(new CustomEvent('gamepad-idle'));
    });
})();
