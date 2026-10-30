/*
 * Controller navigation inside the Home Assistant view.
 *
 * main.js injects this file with webContents.executeJavaScriptInIsolatedWorld(), so it shares
 * Home Assistant's DOM but none of its JavaScript: the page can neither see nor call anything
 * defined here. main.js calls globalThis.__hadGamepad.run(command) for every controller command
 * and acts on the plain object it returns: { rect, key, hold, pointer, at, history, scroll }.
 *
 * Targets are focusable controls, plus the clickable areas of cards that offer no keyboard focus
 * (many custom cards): those are aimed at rather than focused, and pressed with the mouse.
 *
 * Home Assistant is built from web components, so every lookup below walks open shadow roots.
 * DOM APIs only, never innerHTML.
 */
(() => {
    'use strict';

    if (globalThis.__hadGamepad) return;

    const RING_ID = 'ha-desktop-gamepad-ring';
    const RING_GAP = 4;
    // Keeps a revealed element clear of Home Assistant's sticky toolbar.
    const SCROLL_MARGIN = '72px 24px';
    // A "clickable" area bigger than this share of the viewport is a backdrop, not a control.
    const CLICKABLE_MAX_AREA = 0.6;
    const DIRECTIONS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const ARROW_KEYS = { up: 'Up', down: 'Down', left: 'Left', right: 'Right' };
    // tabindex="-1" elements with these roles are items of a composite widget that moves focus
    // between its items itself (Home Assistant's sidebar list, menus, tab bars), so they are valid
    // targets; other tabindex="-1" elements are usually containers.
    const ITEM_ROLES = new Set(['button', 'link', 'checkbox', 'switch', 'radio', 'tab', 'option', 'menuitem',
        'menuitemcheckbox', 'menuitemradio', 'treeitem', 'listitem', 'row', 'gridcell', 'slider', 'spinbutton',
        'combobox', 'textbox', 'searchbox']);
    const SPACE_ROLES = new Set(['checkbox', 'switch', 'radio', 'menuitemcheckbox', 'menuitemradio']);
    const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number', 'date',
        'datetime-local', 'month', 'time', 'week']);
    const SKIPPED_TAGS = new Set(['script', 'style', 'template', 'link', 'meta', 'title']);

    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

    // ─── Composed-tree helpers ──────────────────────────────────────────────

    // Parent as rendered: a slotted element belongs to its slot (menu items inside a dropdown's
    // menu, dialog content inside the dialog), and a shadow root to its host.
    const parentOf = (node) => {
        if (node.assignedSlot) return node.assignedSlot;
        const parent = node.parentNode;
        return parent && parent.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? parent.host || null : parent;
    };

    const contains = (ancestor, node) => {
        for (let n = node; n; n = parentOf(n)) if (n === ancestor) return true;
        return false;
    };

    const closest = (node, test) => {
        for (let n = node; n; n = parentOf(n)) if (n.nodeType === Node.ELEMENT_NODE && test(n)) return n;
        return null;
    };

    // document.activeElement stops at shadow hosts; follow focus down to the real element.
    const activeElement = () => {
        let el = document.activeElement;
        while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
        return el && el !== document.body && el !== document.documentElement ? el : null;
    };

    // Dialogs, menus and open dropdowns confine navigation, as their focus traps do for Tab, and B
    // closes them.
    const isScope = (el) => {
        if (el.localName === 'dialog') return el.open;
        const role = el.getAttribute('role');
        if (role === 'dialog' || role === 'alertdialog' || role === 'menu' || el.getAttribute('aria-modal') === 'true') return true;
        if (el.hasAttribute('popover')) return el.id !== RING_ID && el.matches(':popover-open');
        // Older select menus float a listbox over the page without the popover API.
        if (role === 'listbox') {
            const position = getComputedStyle(el).position;
            return position === 'fixed' || position === 'absolute';
        }
        return false;
    };

    const isFocusable = (el) => {
        if (el.tabIndex < 0 && !(el.hasAttribute('tabindex') && ITEM_ROLES.has(el.getAttribute('role')))) return false;
        if (el.disabled || el.getAttribute('aria-disabled') === 'true' || el.getAttribute('aria-hidden') === 'true') return false;
        // A host that delegates focus is reached through the control inside it.
        if (el.shadowRoot && el.shadowRoot.delegatesFocus) return false;
        return el.localName !== 'slot' && !isScope(el);
    };

    const hasPointer = (el) => !!el && el.nodeType === Node.ELEMENT_NODE && getComputedStyle(el).cursor === 'pointer';

    // One pass over the composed tree: focusable controls, clickable areas (the outermost element
    // with a pointer cursor, judged against its parent as rendered) and dialog/menu containers.
    const scan = () => {
        const focusables = [];
        const clickables = [];
        const scopes = [];
        const stack = [document.documentElement];
        while (stack.length) {
            const el = stack.pop();
            if (el.inert || el.id === RING_ID || SKIPPED_TAGS.has(el.localName)) continue;
            if (isFocusable(el)) focusables.push(el);
            else if (isScope(el)) scopes.push(el);
            else if (hasPointer(el) && !hasPointer(parentOf(el))) clickables.push(el);
            const children = el.children;
            for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
            const root = el.shadowRoot;
            if (root) for (let i = root.children.length - 1; i >= 0; i--) stack.push(root.children[i]);
        }
        // A clickable area is reached through focusable controls when it holds some, or when it is
        // part of one (an icon inside a button).
        const candidates = new Set(clickables);
        const focusableSet = new Set(focusables);
        const covered = new Set();
        for (const el of focusables) {
            for (let n = parentOf(el); n; n = parentOf(n)) if (candidates.has(n)) covered.add(n);
        }
        const inFocusable = (el) => {
            for (let n = parentOf(el); n; n = parentOf(n)) if (focusableSet.has(n)) return true;
            return false;
        };
        return { focusables, clickables: clickables.filter((el) => !covered.has(el) && !inFocusable(el)), scopes };
    };

    const visibleRect = (el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return null;
        if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) return null;
        return r;
    };

    const inViewport = (r) => r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;

    const centerOf = (el) => {
        const r = el.getBoundingClientRect();
        return [r.left + r.width / 2, r.top + r.height / 2];
    };

    // The dialog or menu currently on top, used when focus isn't inside it yet.
    const openScope = (scopes) => {
        for (let i = scopes.length - 1; i >= 0; i--) {
            const el = scopes[i];
            const modal = el.localName === 'dialog'
                ? el.matches(':modal')
                : el.getAttribute('aria-modal') === 'true' || el.getAttribute('role') === 'menu';
            if (modal && visibleRect(el)) return el;
        }
        return null;
    };

    const sidebarElement = () => {
        const app = document.querySelector('home-assistant');
        const main = app && app.shadowRoot && app.shadowRoot.querySelector('home-assistant-main');
        return (main && main.shadowRoot && main.shadowRoot.querySelector('ha-sidebar')) || null;
    };

    // ─── Where the controller is ────────────────────────────────────────────

    // A clickable area the ring is on; it has no keyboard focus, so it is tracked here.
    let aimed = null;

    // What the controller is on: the aimed clickable area, otherwise the focused element.
    const current = () => {
        if (aimed && !(aimed.isConnected && visibleRect(aimed))) aimed = null;
        return aimed || activeElement();
    };

    // Everything the controller can reach right now: inside the open dialog or menu if there is
    // one, otherwise the whole page.
    const context = () => {
        const active = current();
        const { focusables, clickables, scopes } = scan();
        const scope = (active && closest(active, isScope)) || openScope(scopes);
        const sidebar = sidebarElement();
        const maxArea = innerWidth * innerHeight * CLICKABLE_MAX_AREA;
        const items = [];
        const add = (el, clickable) => {
            if (scope && !contains(scope, el)) return;
            const r = visibleRect(el);
            if (!r || (clickable && r.width * r.height > maxArea)) return;
            items.push({ el, r, clickable, inSidebar: !!sidebar && contains(sidebar, el) });
        };
        for (const el of focusables) add(el, false);
        for (const el of clickables) add(el, true);
        return { active, scope, sidebar, items };
    };

    // ─── Choosing a target ──────────────────────────────────────────────────

    // Spatial navigation in the spirit of Chromium's (spatial_navigation.cc): the nearest element on
    // the requested side, strongly preferring ones in the same row or column as the current element.
    // Strict mode keeps to that row or column; see the threshold below.
    const nearest = (from, dir, items, exclude, strict = true) => {
        const [dx, dy] = DIRECTIONS[dir];
        const fx = (from.left + from.right) / 2;
        const fy = (from.top + from.bottom) / 2;
        let best = null;
        let bestScore = Infinity;
        for (const item of items) {
            if (item.el === exclude) continue;
            const r = item.r;
            const cx = (r.left + r.right) / 2;
            const cy = (r.top + r.bottom) / 2;
            const along = (cx - fx) * dx + (cy - fy) * dy;
            if (along < 1) continue;
            const encloses = r.left <= from.left + 1 && r.right >= from.right - 1
                && r.top <= from.top + 1 && r.bottom >= from.bottom - 1;
            const inside = r.left >= from.left - 1 && r.right <= from.right + 1
                && r.top >= from.top - 1 && r.bottom <= from.bottom + 1;
            // A separate element must reach past the current one's edge on that side (as in
            // Chromium and Android); nested ones, like a tile's icon inside its card, go by centres.
            const beyond = dx < 0 ? r.left < from.left - 1 : dx > 0 ? r.right > from.right + 1
                : dy < 0 ? r.top < from.top - 1 : r.bottom > from.bottom + 1;
            if (!beyond && !inside && !encloses) continue;
            const gap = Math.max(0, dx > 0 ? r.left - from.right : dx < 0 ? from.left - r.right
                : dy > 0 ? r.top - from.bottom : from.top - r.bottom);
            const offAxis = dx
                ? Math.max(0, Math.max(r.top, from.top) - Math.min(r.bottom, from.bottom))
                : Math.max(0, Math.max(r.left, from.left) - Math.min(r.right, from.right));
            // Stay in the current row or column: left/right may drift a little up or down (uneven
            // columns), up/down must overlap horizontally, so the end of a column doesn't jump to
            // another one. When nothing qualifies the page scrolls instead.
            if (strict && !inside && !encloses && offAxis > (dx ? Math.max(from.height, 96) : 16)) continue;
            // Like Chromium, anything outside the current row (or column) pays half the current
            // element's size on top, so a far neighbour in the same row beats a near diagonal one.
            const misaligned = offAxis > 0 ? offAxis + (dx ? from.height : from.width) / 2 : 0;
            // Something that encloses the current element (a card around its own button) only wins
            // when nothing closer exists.
            let score = encloses ? 48 + along : gap + misaligned * (dx ? 30 : 2);
            // Tie-breaks: nearest centre first, then the best aligned.
            score += along / 1000 + Math.abs(dx ? cy - fy : cx - fx) / 100;
            if (score < bestScore) {
                best = item;
                bestScore = score;
            }
        }
        return best;
    };

    // App chrome (sidebar, toolbar) comes after dashboard content when picking a starting point.
    const isChrome = (el) => !!closest(el, (n) => n.localName === 'ha-sidebar'
        || n.localName === 'header' || n.classList.contains('toolbar'));

    // The first item in reading order, preferring dashboard content that is fully on screen.
    const firstItem = (items) => {
        const rtl = getComputedStyle(document.documentElement).direction === 'rtl';
        const onScreen = items.filter(({ r }) => r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth);
        let best = null;
        let bestKey = null;
        for (const item of onScreen.length ? onScreen : items) {
            const key = [isChrome(item.el) ? 1 : 0, Math.round(item.r.top / 24), rtl ? -item.r.right : item.r.left];
            const better = !best || key[0] < bestKey[0]
                || (key[0] === bestKey[0] && (key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])));
            if (better) {
                best = item;
                bestKey = key;
            }
        }
        return best;
    };

    const isTextEntry = (el) => el.isContentEditable || el.localName === 'textarea'
        || (el.localName === 'input' && TEXT_INPUT_TYPES.has(el.type));

    // Sliders keep their arrow keys along their own axis: 'x', 'y' or null.
    const sliderAxis = (el) => {
        const role = el.getAttribute('role');
        if (role === 'spinbutton') return 'y';
        if (role === 'slider' || role === 'scrollbar' || (el.localName === 'input' && el.type === 'range')) {
            return el.getAttribute('aria-orientation') === 'vertical' ? 'y' : 'x';
        }
        return null;
    };

    // Switches, checkboxes and radios toggle on Space; everything else activates on Enter.
    const activationKey = (el) => {
        if (SPACE_ROLES.has(el.getAttribute('role'))) return 'Space';
        if (el.localName === 'input' && (el.type === 'checkbox' || el.type === 'radio')) return 'Space';
        return 'Enter';
    };

    // ─── Focus ring ─────────────────────────────────────────────────────────

    let ring = null;
    let ringTarget = null;
    let ringScope = null;
    let shown = false;
    let trackUntil = 0;
    let trackFrame = 0;
    let trackTimer = 0;
    let lastCommandAt = 0;
    // Mouse events main.js sends for us must not count as the user taking over with the mouse.
    let ownPointerUntil = 0;
    // The ring goes away after a minute without controller input; the next input brings it back.
    const IDLE_HIDE_MS = 60000;

    const createRing = () => {
        const el = document.createElement('div');
        el.id = RING_ID;
        el.setAttribute('aria-hidden', 'true');
        // A manual popover is drawn in the top layer, so the ring also shows above modal dialogs.
        el.popover = 'manual';
        const style = el.style;
        style.setProperty('position', 'fixed');
        style.setProperty('inset', 'auto');
        style.setProperty('margin', '0');
        style.setProperty('padding', '0');
        style.setProperty('box-sizing', 'border-box');
        style.setProperty('border', '3px solid var(--primary-color, #03a9f4)');
        style.setProperty('background', 'transparent');
        style.setProperty('box-shadow', '0 0 0 2px rgba(0, 0, 0, 0.35), 0 0 16px 1px var(--primary-color, #03a9f4)');
        style.setProperty('pointer-events', 'none');
        style.setProperty('overflow', 'visible');
        style.setProperty('z-index', '2147483647');
        return el;
    };

    const openRing = (scope) => {
        if (!ring) ring = createRing();
        if (!ring.isConnected) (document.body || document.documentElement).append(ring);
        ring.style.setProperty('transition', reducedMotion.matches ? 'none'
            : 'left 120ms ease-out, top 120ms ease-out, width 120ms ease-out, height 120ms ease-out, transform 120ms ease-out');
        if (!ring.hasAttribute('popover')) {
            ring.style.setProperty('display', 'block');
        } else {
            try {
                // Re-open on entering a dialog so the ring is back on top of the top-layer stack.
                if (ring.matches(':popover-open') && scope !== ringScope) ring.hidePopover();
                if (!ring.matches(':popover-open')) ring.showPopover();
            } catch (_) {
                ring.removeAttribute('popover');
                ring.style.setProperty('display', 'block');
            }
        }
        ringScope = scope;
    };

    const placeRing = () => {
        if (!shown || !ring) return;
        const el = current();
        const r = el && !isScope(el) ? el.getBoundingClientRect() : null;
        if (!r || r.width < 1 || r.height < 1 || !inViewport(r)) {
            // Focus is gone for now (a dialog closed), sits on a dialog itself rather than one of
            // its controls, or was scrolled away; the ring comes back with it.
            ring.style.setProperty('opacity', '0');
            ringTarget = null;
            return;
        }
        if (el !== ringTarget) {
            ringTarget = el;
            const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
            ring.style.setProperty('border-radius', `${Math.round(radius + RING_GAP)}px`);
        }
        // Clamp to the viewport so the ring stays visible around oversized elements.
        const left = Math.round(Math.max(2, r.left - RING_GAP));
        const top = Math.round(Math.max(2, r.top - RING_GAP));
        const right = Math.round(Math.min(innerWidth - 2, r.right + RING_GAP));
        const bottom = Math.round(Math.min(innerHeight - 2, r.bottom + RING_GAP));
        const style = ring.style;
        style.setProperty('left', `${left}px`);
        style.setProperty('top', `${top}px`);
        style.setProperty('width', `${Math.max(0, right - left)}px`);
        style.setProperty('height', `${Math.max(0, bottom - top)}px`);
        style.setProperty('opacity', '1');
    };

    // Follows the target every frame for a while (smooth scrolling, dialog animations), then a few
    // times a second while the ring stays up.
    const trackStep = () => {
        trackFrame = 0;
        trackTimer = 0;
        if (!shown) return;
        if (performance.now() - lastCommandAt > IDLE_HIDE_MS) {
            hideRing();
            return;
        }
        placeRing();
        if (performance.now() < trackUntil) trackFrame = requestAnimationFrame(trackStep);
        else trackTimer = setTimeout(trackStep, 250);
    };

    const track = (ms) => {
        trackUntil = Math.max(trackUntil, performance.now() + ms);
        clearTimeout(trackTimer);
        trackTimer = 0;
        if (!trackFrame) trackFrame = requestAnimationFrame(trackStep);
    };

    const showRing = (scope) => {
        shown = true;
        openRing(scope);
        placeRing();
        track(700);
    };

    const hideRing = () => {
        shown = false;
        aimed = null;
        cancelAnimationFrame(trackFrame);
        clearTimeout(trackTimer);
        trackFrame = 0;
        trackTimer = 0;
        ringTarget = null;
        if (ring && ring.isConnected) {
            ring.style.removeProperty('transform');
            if (!ring.hasAttribute('popover')) ring.style.setProperty('display', 'none');
            else if (ring.matches(':popover-open')) ring.hidePopover();
        }
    };

    const setPressed = (pressed) => {
        if (ring) ring.style.setProperty('transform', pressed ? 'scale(0.97)' : 'none');
    };

    const pulse = () => {
        if (ring && !reducedMotion.matches) {
            ring.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.05)' }, { transform: 'scale(1)' }], 260);
        }
    };

    // Home Assistant moved focus (opened a dialog, gave focus back after a menu): follow it, unless
    // it only focused the card around the clickable area we are aiming at.
    addEventListener('focusin', () => {
        const el = activeElement();
        if (aimed && !(el && contains(el, aimed))) aimed = null;
        if (!shown) return;
        // A dialog that just opened sits above the ring in the top layer: raise the ring again.
        const scope = el ? closest(el, isScope) : null;
        if (scope !== ringScope) openRing(scope);
        track(400);
    }, { capture: true, passive: true });

    // Touch or mouse input hands control back: hide the ring until the next controller input.
    addEventListener('pointerdown', () => {
        if (shown && performance.now() > ownPointerUntil) hideRing();
    }, { capture: true, passive: true });
    addEventListener('pointermove', (event) => {
        if (shown && performance.now() > ownPointerUntil && event.pointerType === 'mouse'
            && Math.abs(event.movementX) + Math.abs(event.movementY) > 6) hideRing();
    }, { capture: true, passive: true });

    const reveal = (el) => {
        const previous = el.style.scrollMargin;
        el.style.scrollMargin = SCROLL_MARGIN;
        el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
        el.style.scrollMargin = previous;
    };

    const moveTo = (el, clickable, scope) => {
        if (clickable) {
            // Nothing to focus: aim at it, and take keyboard focus off the previous control so
            // keys stop going there (except in dialogs, whose focus traps would pull it back).
            const active = activeElement();
            if (active && !scope) active.blur();
            aimed = el;
        } else {
            aimed = null;
            el.focus({ preventScroll: true });
            // Some elements look focusable but refuse focus (e.g. a link without an href); aim at
            // those instead, or every press that way would pick the same element again.
            const active = activeElement();
            if (!active || !(active === el || contains(el, active))) aimed = el;
        }
        reveal(el);
        showRing(scope);
    };

    // Shows the ring without acting: on the current target if it is on screen, otherwise on the
    // first item in view.
    const wake = ({ active, scope, items }) => {
        const r = active && active !== scope ? visibleRect(active) : null;
        if (r && inViewport(r)) {
            showRing(scope);
            return;
        }
        const first = firstItem(items);
        if (first) moveTo(first.el, first.clickable, scope);
    };

    const onScreen = () => {
        const el = current();
        const r = el && visibleRect(el);
        return r && inViewport(r) ? el : null;
    };

    const status = (extra) => {
        const el = shown ? current() : null;
        const r = el ? el.getBoundingClientRect() : null;
        const rect = r && r.width && r.height ? [r.left, r.top, r.width, r.height] : null;
        if (extra && extra.pointer) ownPointerUntil = performance.now() + 1200;
        return Object.assign({ rect }, extra);
    };

    // ─── Sidebar ────────────────────────────────────────────────────────────

    let returnTo = null;

    // Length of the item's link path if the current page is in its section, else 0.
    const linkMatch = (el) => {
        const link = el.localName === 'a' ? el
            : el.querySelector('a[href]') || (el.shadowRoot && el.shadowRoot.querySelector('a[href]'));
        if (!link || !link.href) return 0;
        const linkPath = new URL(link.href, location.href).pathname.replace(/\/$/, '');
        const page = location.pathname.replace(/\/$/, '');
        return linkPath && (page === linkPath || page.startsWith(`${linkPath}/`)) ? linkPath.length : 0;
    };

    // Focuses the sidebar entry for the current page (or its first entry).
    const focusSidebar = (sidebar) => {
        const inside = context().items.filter((item) => item.inSidebar && !item.clickable);
        if (!inside.length) return false;
        let target = inside[0];
        let best = 0;
        for (const item of inside) {
            const match = linkMatch(item.el);
            if (match > best) {
                best = match;
                target = item;
            }
        }
        moveTo(target.el, false, null);
        return true;
    };

    // The sidebar is a modal drawer on narrow windows: open it first, focus its items after the slide-in.
    const toggleDrawer = (sidebar) => {
        sidebar.dispatchEvent(new CustomEvent('hass-toggle-menu', { bubbles: true, composed: true }));
    };

    const enterSidebar = (sidebar, active) => {
        returnTo = active ? { ref: new WeakRef(active), clickable: active === aimed } : null;
        const r = visibleRect(sidebar);
        if (r && inViewport(r)) {
            focusSidebar(sidebar);
            return;
        }
        toggleDrawer(sidebar);
        setTimeout(() => focusSidebar(sidebar), 300);
    };

    const leaveSidebar = (sidebar) => {
        const drawer = closest(sidebar, (n) => n.getAttribute('type') === 'modal' && n.hasAttribute('open'));
        if (drawer) toggleDrawer(sidebar);
        const previous = returnTo && returnTo.ref.deref();
        const clickable = !!returnTo && returnTo.clickable;
        returnTo = null;
        const r = previous && previous.isConnected ? visibleRect(previous) : null;
        if (r && inViewport(r)) {
            moveTo(previous, clickable, null);
            return;
        }
        const first = firstItem(context().items.filter((item) => !item.inSidebar));
        if (first) moveTo(first.el, first.clickable, null);
    };

    // ─── Commands ───────────────────────────────────────────────────────────

    let pressWoke = false;
    let pointerAt = null; // where main.js holds the mouse button down for us

    const navigate = (dir, phase) => {
        const ctx = context();
        const { active, scope, sidebar, items } = ctx;
        const r = active && active !== scope ? visibleRect(active) : null;
        if (!r || !inViewport(r) || (!shown && phase === 'press')) {
            wake(ctx);
            return status();
        }
        if (!aimed) {
            const axis = sliderAxis(active);
            if (axis && axis === (DIRECTIONS[dir][0] ? 'x' : 'y')) return status({ key: ARROW_KEYS[dir], hold: true });
        }
        // Up and down stay on their side of the sidebar's edge; left and right cross it.
        const vertical = !!DIRECTIONS[dir][1];
        const inSidebar = !!sidebar && contains(sidebar, active);
        const pool = vertical ? items.filter((item) => item.inSidebar === inSidebar) : items;
        let next = nearest(r, dir, pool, active);
        // From the toolbar, down may land on content that isn't in the same column (a narrow
        // dashboard centred under a wide toolbar).
        if (!next && vertical && isChrome(active)) next = nearest(r, dir, pool, active, false);
        if (!next) return status({ scroll: dir });
        moveTo(next.el, next.clickable, scope);
        return status();
    };

    const press = () => {
        const el = shown ? onScreen() : null;
        if (!el) {
            pressWoke = true;
            wake(context());
            return status();
        }
        pressWoke = false;
        setPressed(true);
        if (el !== aimed) return status();
        // Clickable areas get a real press, so each card's own tap and long-press handling applies.
        pointerAt = centerOf(el);
        return status({ pointer: 'down', at: pointerAt });
    };

    const releasePointer = () => {
        const at = pointerAt;
        pointerAt = null;
        return at ? status({ pointer: 'up', at }) : null;
    };

    const select = () => {
        setPressed(false);
        if (pressWoke) {
            pressWoke = false;
            return status();
        }
        const released = releasePointer();
        if (released) return released;
        const el = shown ? onScreen() : null;
        // Text fields stay focused for typing; Enter there would submit forms.
        if (!el || el === aimed || isTextEntry(el)) return status();
        return status({ key: activationKey(el) });
    };

    // Home Assistant's hold action (usually "more info"), as a long press would trigger it.
    const hold = () => {
        if (pressWoke || pointerAt) return status(); // A is still down: the card times the long press itself
        setPressed(false);
        const el = shown ? onScreen() : null;
        if (!el) {
            wake(context());
            return status();
        }
        pulse();
        if (el === aimed) return status({ pointer: 'hold', at: centerOf(el) });
        el.dispatchEvent(new CustomEvent('action', { bubbles: true, composed: true, detail: { action: 'hold' } }));
        return status();
    };

    const release = () => {
        setPressed(false);
        pressWoke = false;
        return releasePointer() || status();
    };

    // The window lost focus or the controller went away mid-press: let go of everything.
    const cancel = () => release();

    // Controller navigation was turned off.
    const hide = () => {
        hideRing();
        pressWoke = false;
        return releasePointer() || {};
    };

    const back = () => {
        const ctx = context();
        if (ctx.sidebar && ctx.active && contains(ctx.sidebar, ctx.active)) {
            leaveSidebar(ctx.sidebar);
            return status();
        }
        if (ctx.scope) return status({ key: 'Escape' });
        return status({ history: 'back' });
    };

    const menu = () => {
        const sidebar = sidebarElement();
        if (!sidebar) return status();
        const active = current();
        if (active && contains(sidebar, active)) leaveSidebar(sidebar);
        else enterSidebar(sidebar, active);
        return status();
    };

    // Previous/next tab of the tab bar nearest the top: the dashboard's views, or a dialog's tabs.
    const tab = (delta) => {
        const { scope, items } = context();
        const bars = new Map();
        for (const item of items) {
            if (item.el.getAttribute('role') !== 'tab') continue;
            const bar = closest(item.el, (n) => n.getAttribute('role') === 'tablist') || parentOf(item.el);
            if (!bars.has(bar)) bars.set(bar, []);
            bars.get(bar).push(item);
        }
        let tabs = null;
        for (const candidate of bars.values()) if (!tabs || candidate[0].r.top < tabs[0].r.top) tabs = candidate;
        if (!tabs) return status();
        tabs.sort((a, b) => a.r.left - b.r.left);
        const selected = tabs.findIndex(({ el }) => el.getAttribute('aria-selected') === 'true');
        const index = selected < 0 ? (delta > 0 ? 0 : tabs.length - 1) : (selected + delta + tabs.length) % tabs.length;
        const target = tabs[index].el;
        target.click();
        moveTo(target, false, scope);
        return status();
    };

    // Opens Assist through Home Assistant's "a" keyboard shortcut (not while typing).
    const assist = () => {
        const active = activeElement();
        return active && isTextEntry(active) ? status() : status({ key: 'a' });
    };

    const COMMANDS = {
        navigate: (command) => navigate(command.dir, command.phase),
        press,
        select,
        hold,
        release,
        back,
        menu,
        tab: (command) => tab(command.delta),
        assist,
        cancel,
        hide,
        status: () => status()
    };
    // Bookkeeping from main.js, not controller input: they don't count as activity.
    const PASSIVE_COMMANDS = new Set(['status', 'cancel', 'hide']);

    globalThis.__hadGamepad = {
        run(command) {
            const handler = command && Object.prototype.hasOwnProperty.call(COMMANDS, command.type) ? COMMANDS[command.type] : null;
            if (!handler) return {};
            if (!PASSIVE_COMMANDS.has(command.type)) lastCommandAt = performance.now();
            try {
                return handler(command) || {};
            } catch (error) {
                return { error: String((error && error.message) || error) };
            } finally {
                // Keys and clicks sent on our behalf open and close menus and dialogs; follow them closely.
                if (shown) track(900);
            }
        }
    };
})();
