const { app, BrowserWindow, BrowserView, ipcMain, shell, Tray, Menu, globalShortcut, nativeTheme, powerMonitor, dialog, autoUpdater } = require('electron');
const path = require('path');
const Store = require('electron-store');
const fs = require('fs');
const os = require('os');
const { exec, execFile } = require('child_process');
const { machineIdSync } = require('node-machine-id');
const util = require('util');
const execPromise = util.promisify(exec);
let keytar;

try {
    keytar = require('keytar');
} catch (_error) {
    keytar = null;
}

const store = new Store();
const TOKEN_SERVICE = 'home-assistant-desktop';
const TOKEN_ACCOUNT = 'ha-api-token';
const DEFAULT_DISPLAY_SCALE = 100;
const MIN_DISPLAY_SCALE = 50;
const MAX_DISPLAY_SCALE = 200;

const haWsManager = { ws: null, reconnectTimer: null, isConnected: false };

const smartConnectState = {
    healthIntervalMs: 300000,
    cooldownMs: 120000,
    lastSwitchAt: 0,
    currentTarget: 'unknown',
    timer: null
};

const sensorDeliveryState = {
    queue: [],
    processing: false,
    replayTimer: null,
    lastErrorAt: 0,
    maxQueueSize: 1000
};

const appLogBuffer = [];
const APP_LOG_LIMIT = 300;

// Load translations
let translations = {};
let currentLanguage = 'en';

function loadTranslations() {
    try {
        const translationsPath = path.join(__dirname, '../locales/translations.json');
        const data = fs.readFileSync(translationsPath, 'utf8');
        translations = JSON.parse(data);
        
        // Get system language or saved preference
        let savedLang = store.get('app-language');
        if (savedLang === 'iw' || savedLang === 'heb') savedLang = 'he';
        if (savedLang && translations[savedLang]) {
            currentLanguage = savedLang;
        } else {
            // Get system language from locale
            let systemLang = 'en';
            try {
                // Try to get from Intl API
                systemLang = Intl.DateTimeFormat().resolvedOptions().locale.split('-')[0];
            } catch (e) {
                // Fallback to process.env
                const envLang = process.env.LANG || process.env.LC_ALL || process.env.LANGUAGE || '';
                systemLang = envLang.split('_')[0].toLowerCase() || 'en';
            }
            if (systemLang === 'iw' || systemLang === 'heb') systemLang = 'he';
            currentLanguage = (systemLang && translations[systemLang]) ? systemLang : 'en';
        }
    } catch (e) {
        console.error('Failed to load translations:', e.message);
        currentLanguage = 'en';
        translations = {};
    }
}

function t(key) {
    const keys = key.split('.');
    let value = translations[currentLanguage] || {};
    
    for (const k of keys) {
        value = value[k];
        if (value === undefined) {
            value = translations['en'] || {};
            for (const fallbackK of keys) {
                value = value[fallbackK];
                if (value === undefined) return key;
            }
            return value;
        }
    }
    return value;
}

let mainWindow;
let view;
let tray;
let isQuiting = false;
let sensorTickTimer;
let sensorGeneration = 0;
let lastSensorReportAt = 0;
// Handle Squirrel Startup (to avoid multiple instances)
if (require('electron-squirrel-startup')) {
    app.quit();
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }

        // Deep linking on Windows/Linux
        const url = commandLine.find(arg => arg.startsWith('ha-desktop://'));
        if (url) {
            handleDeepLink(url);
        }

        // Check if the second instance was launched with --quit
        if (commandLine.includes('--quit')) {
            isQuiting = true;
            app.quit();
        }
    });
}

// Check if launched with --quit (Cold Start)
if (process.argv.includes('--quit')) {
    app.quit();
}

if (!store.get('hardwareAcceleration', true)) {
    app.disableHardwareAcceleration();
}

app.on('render-process-gone', (event, webContents, details) => {
    addAppLog('error', 'Render process gone', details.reason);
    if (details.reason === 'crashed' || details.reason === 'oom') {
        app.quit();
        app.exit(1);
    }
});

app.on('child-process-gone', (event, details) => {
    addAppLog('error', 'Child process gone', details.reason);
    if (details.reason === 'crashed' || details.reason === 'oom') {
        app.quit();
        app.exit(1);
    }
});

if (process.platform === 'linux') {
    if (process.env.WAYLAND_DISPLAY) {
        app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations');
        app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
    } else {
        // X11 session (e.g. GNOME/Cinnamon/KDE on X): pin to x11 backend.
        // ozone-platform-hint=auto on X11 causes Chromium to probe both backends
        // and can accumulate GPU memory across the GPU process lifetime.
        app.commandLine.appendSwitch('ozone-platform', 'x11');
    }
    app.commandLine.appendSwitch('disable-gpu-memory-buffer-video-frames');
}


// Initialize Auto Updater
const { updateElectronApp } = require('update-electron-app');

// Load translations first
loadTranslations();

if (store.get('autoUpdates', true)) {
    updateElectronApp({
        repo: 'nexos20lv/Home-Assistant-Desktop',
        updateInterval: '1 hour'
    });
}

function addAppLog(level, message, details = null) {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        details
    };
    appLogBuffer.push(entry);
    if (appLogBuffer.length > APP_LOG_LIMIT) {
        appLogBuffer.splice(0, appLogBuffer.length - APP_LOG_LIMIT);
    }
}

async function getApiToken() {
    if (keytar) {
        try {
            return await keytar.getPassword(TOKEN_SERVICE, TOKEN_ACCOUNT);
        } catch (error) {
            addAppLog('error', 'Failed reading token from keychain', error.message);
        }
    }
    return store.get('apiToken', '');
}

async function setApiToken(token) {
    if (keytar) {
        try {
            if (token) {
                await keytar.setPassword(TOKEN_SERVICE, TOKEN_ACCOUNT, token);
            } else {
                await keytar.deletePassword(TOKEN_SERVICE, TOKEN_ACCOUNT);
            }
            store.delete('apiToken');
            return;
        } catch (error) {
            addAppLog('error', 'Failed writing token to keychain, fallback to store', error.message);
        }
    }
    store.set('apiToken', token || '');
}

function normalizeUrl(rawUrl) {
    const value = (rawUrl || '').trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    return `http://${value}`;
}

function normalizeDisplayScale(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_DISPLAY_SCALE;
    const rounded = Math.round(parsed);
    return Math.max(MIN_DISPLAY_SCALE, Math.min(MAX_DISPLAY_SCALE, rounded));
}

function timeoutPromise(ms) {
    return new Promise((resolve) => {
        setTimeout(() => resolve({ ok: false, timeout: true }), ms);
    });
}

function healthCheckRequest(url, token) {
    const { net } = require('electron');

    return new Promise((resolve) => {
        try {
            const request = net.request({
                method: 'GET',
                url: `${url}/api/`
            });

            if (token) {
                request.setHeader('Authorization', `Bearer ${token}`);
            }

            request.on('response', (response) => {
                const code = response.statusCode || 0;
                const authRequired = code === 401 || code === 403;
                const ok = code >= 200 && code < 500;
                response.on('data', () => {});
                response.on('end', () => resolve({ ok, code, authRequired }));
                response.on('error', () => resolve({ ok: false, code }));
            });

            request.on('error', (error) => {
                resolve({ ok: false, message: error.message });
            });

            request.end();
        } catch (error) {
            resolve({ ok: false, message: error.message });
        }
    });
}

async function testHaConnection(url, token = '') {
    const normalized = normalizeUrl(url);
    if (!normalized) {
        return { ok: false, message: 'Missing URL.' };
    }

    try {
        new URL(normalized);
    } catch (_error) {
        return { ok: false, message: 'Invalid URL.' };
    }

    const result = await Promise.race([
        healthCheckRequest(normalized, token),
        timeoutPromise(7000)
    ]);

    if (result.timeout) {
        return { ok: false, message: 'Timeout: instance unreachable.' };
    }

    if (!result.ok) {
        if (result.message && /certificate|ssl|tls/i.test(result.message)) {
            return { ok: false, message: 'SSL/TLS certificate error.' };
        }
        return { ok: false, message: `Connection failed (${result.message || 'network error'}).` };
    }

    return {
        ok: true,
        authRequired: !!result.authRequired,
        code: result.code
    };
}

function emitNetworkStatus() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('network-status', {
        target: smartConnectState.currentTarget,
        updatedAt: Date.now()
    });
}

async function evaluateSmartConnect() {
    const localUrl = normalizeUrl(store.get('haUrl', ''));
    const remoteUrl = normalizeUrl(store.get('remoteUrl', ''));
    const forceRemote = store.get('useRemote', false);
    const smartConnectEnabled = store.get('smartConnectEnabled', true);
    const token = await getApiToken();

    let desired = 'offline';
    let resolvedUrl = '';

    if (forceRemote && remoteUrl) {
        desired = 'remote';
        resolvedUrl = remoteUrl;
    } else if (!smartConnectEnabled) {
        if (localUrl) {
            desired = 'local';
            resolvedUrl = localUrl;
        }
    } else {
        const [localStatus, remoteStatus] = await Promise.all([
            localUrl ? testHaConnection(localUrl, token) : Promise.resolve({ ok: false }),
            remoteUrl ? testHaConnection(remoteUrl, token) : Promise.resolve({ ok: false })
        ]);

        if (localStatus.ok) {
            desired = 'local';
            resolvedUrl = localUrl;
        } else if (remoteStatus.ok) {
            desired = 'remote';
            resolvedUrl = remoteUrl;
        }
    }

    if (smartConnectState.currentTarget === 'unknown') {
        smartConnectState.currentTarget = desired;
        emitNetworkStatus();
    }

    const isSwitch = desired !== smartConnectState.currentTarget;
    if (isSwitch) {
        const cooldownElapsed = (Date.now() - smartConnectState.lastSwitchAt) >= smartConnectState.cooldownMs;
        if (!cooldownElapsed && smartConnectState.currentTarget !== 'unknown') {
            emitNetworkStatus();
            return;
        }

        smartConnectState.currentTarget = desired;
        smartConnectState.lastSwitchAt = Date.now();
        emitNetworkStatus();
        addAppLog('info', `SmartConnect switched to ${desired}`);

        if (view && resolvedUrl) {
            try {
                const currentUrl = view.webContents.getURL() || '';
                if (!currentUrl.startsWith(resolvedUrl)) {
                    view.webContents.loadURL(resolvedUrl);
                }
            } catch (_error) {
                // BrowserView might not be ready yet.
            }
        }
    } else {
        emitNetworkStatus();
    }
}

function startSmartConnectMonitor() {
    if (smartConnectState.timer) clearInterval(smartConnectState.timer);
    smartConnectState.timer = setInterval(() => {
        evaluateSmartConnect().catch((error) => {
            addAppLog('error', 'SmartConnect monitor failure', error.message);
        });
    }, smartConnectState.healthIntervalMs);

    evaluateSmartConnect().catch((error) => {
        addAppLog('error', 'Initial SmartConnect evaluation failure', error.message);
    });
}

function getCurrentBaseUrl() {
    if (smartConnectState.currentTarget === 'remote') {
        return normalizeUrl(store.get('remoteUrl', ''));
    }
    if (smartConnectState.currentTarget === 'local') {
        return normalizeUrl(store.get('haUrl', ''));
    }
    return normalizeUrl(getEffectiveUrl() || '');
}

function scheduleSensorReplay() {
    if (sensorDeliveryState.replayTimer) clearInterval(sensorDeliveryState.replayTimer);
    sensorDeliveryState.replayTimer = setInterval(async () => {
        if (!sensorDeliveryState.queue.length || sensorDeliveryState.processing) return;
        await flushSensorQueue();
    }, 10000);
}

function enqueueSensorReport(baseUrl, token, entityId, data, options = {}) {
    const item = {
        baseUrl,
        token,
        entityId,
        data,
        attempts: options.attempts || 0,
        nextAttemptAt: options.nextAttemptAt || Date.now()
    };

    if (sensorDeliveryState.queue.length >= sensorDeliveryState.maxQueueSize) {
        sensorDeliveryState.queue.shift();
    }
    sensorDeliveryState.queue.push(item);
}

async function flushSensorQueue() {
    if (sensorDeliveryState.processing) return;
    sensorDeliveryState.processing = true;

    try {
        const now = Date.now();
        const pending = [...sensorDeliveryState.queue];
        sensorDeliveryState.queue = [];

        for (const item of pending) {
            if (item.nextAttemptAt > now) {
                sensorDeliveryState.queue.push(item);
                continue;
            }

            const result = await postSensor(item.baseUrl, item.token, item.entityId, item.data);
            if (!result.ok) {
                const attempts = item.attempts + 1;
                const backoffMs = Math.min(300000, Math.pow(2, attempts) * 5000);
                sensorDeliveryState.queue.push({
                    ...item,
                    attempts,
                    nextAttemptAt: Date.now() + backoffMs
                });

                if (Date.now() - sensorDeliveryState.lastErrorAt > 15000) {
                    addAppLog('warn', 'Sensor delivery failed, queued for retry', result.message || result.code || 'unknown');
                    sensorDeliveryState.lastErrorAt = Date.now();
                }
            }
        }
    } finally {
        sensorDeliveryState.processing = false;
    }
}

function isStartupScriptSafe(command) {
    if (!command || command.length > 200) return false;

    const blockedPatterns = [
        /rm\s+-rf\s+\//i,
        /mkfs/i,
        /shutdown/i,
        /reboot/i,
        /:\(\)\s*\{/,
        /\bdel\b\s+\/s/i,
        /\bdd\b\s+if=/i
    ];

    if (/&&|\|\||;/g.test(command)) return false;
    return !blockedPatterns.some((pattern) => pattern.test(command));
}

// ─── Multi-server profiles ───────────────────────────────────────────────────

function loadServers() {
    let servers = store.get('servers', null);
    if (!servers) {
        const haUrl = store.get('haUrl', '');
        const remoteUrl = store.get('remoteUrl', '');
        servers = haUrl
            ? [{ id: '1', name: 'Home', localUrl: haUrl, remoteUrl: remoteUrl || '', useRemote: store.get('useRemote', false), smartConnect: store.get('smartConnectEnabled', true) }]
            : [];
        store.set('servers', servers);
        if (servers.length) store.set('activeServerId', '1');
    }
    return servers;
}

function getActiveServer() {
    const servers = store.get('servers', []);
    const activeId = store.get('activeServerId', servers[0]?.id);
    return servers.find(s => s.id === activeId) || servers[0] || null;
}

function switchToServer(id) {
    const servers = store.get('servers', []);
    const server = servers.find(s => s.id === id);
    if (!server) return;
    store.set('activeServerId', id);
    store.set('haUrl', server.localUrl);
    store.set('remoteUrl', server.remoteUrl || '');
    store.set('useRemote', server.useRemote || false);
    store.set('smartConnectEnabled', server.smartConnect !== false);
    smartConnectState.currentTarget = 'unknown';
    if (view && !view.webContents.isDestroyed()) {
        const url = server.useRemote ? server.remoteUrl : server.localUrl;
        if (url) view.webContents.loadURL(url);
    }
    evaluateSmartConnect().catch(() => {});
    updateTrayMenu();
    connectHaWebSocket().catch(() => {});
}

function updateTrayMenu() {
    if (!tray) return;
    const servers = store.get('servers', []);
    const activeId = store.get('activeServerId', '');
    const serverItems = servers.length > 1
        ? [{ label: 'Servers', submenu: servers.map(s => ({ label: s.name || s.localUrl, type: 'radio', checked: s.id === activeId, click: () => switchToServer(s.id) })) }, { type: 'separator' }]
        : [];
    const contextMenu = Menu.buildFromTemplate([
        { label: t('tray.show'), click: () => mainWindow && mainWindow.show() },
        { label: '🪟 Quick Controls Widget', click: () => toggleWidgetWindow() },
        { type: 'separator' },
        ...serverItems,
        { label: t('tray.support'), click: () => shell.openExternal('https://buymeacoffee.com/nexos20') },
        { type: 'separator' },
        { label: t('tray.reset'), click: () => { store.delete('haUrl'); store.delete('servers'); app.relaunch(); app.exit(0); } },
        { type: 'separator' },
        { label: t('tray.quit'), click: () => { isQuiting = true; app.quit(); } }
    ]);
    tray.setToolTip(t('app.name'));
    tray.setContextMenu(contextMenu);
}

// ─── WebSocket connection monitor ────────────────────────────────────────────

async function connectHaWebSocket() {
    if (haWsManager.reconnectTimer) { clearTimeout(haWsManager.reconnectTimer); haWsManager.reconnectTimer = null; }
    if (haWsManager.ws) { haWsManager.ws.onclose = null; try { haWsManager.ws.close(); } catch (_) {} haWsManager.ws = null; }

    const baseUrl = getCurrentBaseUrl() || getEffectiveUrl();
    if (!baseUrl) return;
    const token = await getApiToken();
    if (!token) return;

    const wsUrl = baseUrl.replace(/^http/, 'ws').replace(/\/$/, '') + '/api/websocket';

    try {
        const ws = new WebSocket(wsUrl);
        haWsManager.ws = ws;

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'auth_required') {
                    ws.send(JSON.stringify({ type: 'auth', access_token: token }));
                } else if (msg.type === 'auth_ok') {
                    haWsManager.isConnected = true;
                    addAppLog('info', 'HA WebSocket authenticated');
                    if (smartConnectState.currentTarget === 'unknown' || smartConnectState.currentTarget === 'offline') {
                        evaluateSmartConnect().catch(() => {});
                    }
                } else if (msg.type === 'auth_invalid') {
                    addAppLog('warn', 'HA WebSocket auth invalid — token may have expired');
                    ws.close();
                }
            } catch (_) {}
        };

        ws.onclose = () => {
            haWsManager.isConnected = false;
            haWsManager.ws = null;
            if (!isQuiting) {
                haWsManager.reconnectTimer = setTimeout(() => connectHaWebSocket().catch(() => {}), 8000);
            }
        };

        ws.onerror = (err) => {
            addAppLog('warn', 'HA WebSocket error', err.message || 'unknown');
        };
    } catch (error) {
        addAppLog('warn', 'HA WebSocket failed to connect', error.message);
        haWsManager.reconnectTimer = setTimeout(() => connectHaWebSocket().catch(() => {}), 15000);
    }
}

function createMainWindow() {
    const haUrl = getCurrentBaseUrl() || getEffectiveUrl();

    if (!haUrl) {
        createSetupWindow();
        return;
    }

    const savedBounds = store.get('windowBounds', { width: 1200, height: 800 });
    const savedMaximized = store.get('windowMaximized', false);

    mainWindow = new BrowserWindow({
        width: savedBounds.width || 1200,
        height: savedBounds.height || 800,
        x: savedBounds.x,
        y: savedBounds.y,
        icon: path.join(__dirname, '../assets/logo.png'),
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#0f172a',
            symbolColor: '#ffffff',
            height: 40 // Match shell.css titlebar height
        },
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js') // IPC for shell buttons
        }
    });

    // Restore maximized state
    if (savedMaximized) mainWindow.maximize();

    // Load the shell (custom title bar)
    mainWindow.loadFile(path.join(__dirname, '../renderer/shell.html'));
    mainWindow.webContents.once('did-finish-load', () => {
        applyShellTheme();
        sendGamepadState();
    });

    // The shell only reads the controller while this window is in the foreground.
    mainWindow.on('focus', sendGamepadState);
    mainWindow.on('blur', () => {
        releaseGamepadKey();
        // Let go of a card press in progress (A held on it) and reset the page's press state.
        if (gamepadState.used) queueGamepadCommand({ type: 'cancel' });
        sendGamepadState();
    });

    const displayScale = normalizeDisplayScale(store.get('displayScale', DEFAULT_DISPLAY_SCALE));

    // Create BrowserView for Home Assistant Content
    view = new BrowserView({
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            partition: 'persist:homeassistant', // Critical for saving login session
            backgroundThrottling: true,
            // Calling setZoomFactor() before the first page load has no effect; this applies from the start.
            zoomFactor: displayScale / 100
        }
    });

    mainWindow.setBrowserView(view);

    view.webContents.on('did-fail-load', (_event, errorCode, errorDescription, _validatedURL, isMainFrame) => {
        // Only Home Assistant's own page failing means it is unreachable; a failing iframe card,
        // or a load aborted by the next navigation (-3), doesn't.
        if (!isMainFrame || errorCode === -3) return;
        addAppLog('warn', 'BrowserView failed to load page', errorDescription);
        smartConnectState.currentTarget = 'offline';
        emitNetworkStatus();
    });

    // Initial bounds setting
    updateViewBounds();

    // Dark Mode Sync
    const syncTheme = () => {
        const isDark = nativeTheme.shouldUseDarkColors;
        view.webContents.executeJavaScript(
            `document.documentElement.setAttribute('data-prefers-color-scheme', '${isDark ? 'dark' : 'light'}');`
        ).catch(() => {});
    };

    nativeTheme.on('updated', syncTheme);
    mainWindow.once('closed', () => nativeTheme.off('updated', syncTheme));

    let customCSSKey = null;
    view.webContents.on('did-finish-load', async () => {
        syncTheme();
        const customCSS = store.get('customCSS', '');
        if (customCSS) {
            if (customCSSKey) {
                await view.webContents.removeInsertedCSS(customCSSKey).catch(() => {});
            }
            customCSSKey = await view.webContents.insertCSS(customCSS);
        }
    });

    // Media Keys Integration
    registerMediaKeys();

    // Context Menu Implementation
    view.webContents.on('context-menu', (event, params) => {
        const menu = Menu.buildFromTemplate([
            { label: t('context.back'), enabled: view.webContents.canGoBack(), click: () => view.webContents.goBack() },
            { label: t('context.forward'), enabled: view.webContents.canGoForward(), click: () => view.webContents.goForward() },
            { label: t('context.reload'), click: () => view.webContents.reload() },
            { type: 'separator' },
            { label: t('context.copyImage'), visible: params.mediaType === 'image', click: () => require('electron').clipboard.writeText(params.srcURL) },
            { label: t('context.inspect'), click: () => view.webContents.inspectElement(params.x, params.y) },
            { type: 'separator' },
            { label: t('tray.show') + ' ' + t('app.name'), click: () => mainWindow && mainWindow.show() },
            { label: t('shell.preferences'), click: () => createPreferencesWindow() }
        ]);
        menu.popup(view);
    });

    // Permission Handling (Notifications, Camera, Mic)
    const { session } = require('electron');
    session.fromPartition('persist:homeassistant').setPermissionRequestHandler((_webContents, permission, callback) => {
        const allowNotifications = true;
        const allowMic = store.get('reportMic', true);
        const allowCamera = store.get('reportCamera', true);

        const permissionAllowed =
            (permission === 'notifications' && allowNotifications) ||
            (permission === 'audioCapture' && allowMic) ||
            (permission === 'videoCapture' && allowCamera) ||
            permission === 'media';

        callback(permissionAllowed);
    });

    // Load HA URL into the view (with optional startup path)
    const _startupPath = store.get('startupPath', '');
    const _startupUrl = _startupPath
        ? haUrl.replace(/\/$/, '') + (_startupPath.startsWith('/') ? _startupPath : '/' + _startupPath)
        : haUrl;
    view.webContents.loadURL(_startupUrl);
    emitNetworkStatus();

    // Handle Resize
    mainWindow.on('resize', updateViewBounds);
    mainWindow.on('maximize', updateViewBounds);
    mainWindow.on('unmaximize', updateViewBounds);
    mainWindow.on('enter-full-screen', updateViewBounds);
    mainWindow.on('leave-full-screen', updateViewBounds);

    // Persist window bounds and maximized state
    let _winStateSaveTimer = null;
    const _saveWindowState = () => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        if (mainWindow.isMaximized()) {
            store.set('windowMaximized', true);
        } else if (!mainWindow.isFullScreen() && !mainWindow.isMinimized()) {
            store.set('windowMaximized', false);
            store.set('windowBounds', mainWindow.getBounds());
        }
    };
    const _debouncedSaveState = () => { clearTimeout(_winStateSaveTimer); _winStateSaveTimer = setTimeout(_saveWindowState, 500); };
    mainWindow.on('resize', _debouncedSaveState);
    mainWindow.on('move', _debouncedSaveState);
    mainWindow.on('maximize', () => store.set('windowMaximized', true));
    mainWindow.on('unmaximize', () => { store.set('windowMaximized', false); store.set('windowBounds', mainWindow.getBounds()); });

    // Battery Power Saver & Background Throttling for WebView when hidden to tray or minimized
    const applyBackgroundThrottling = (isThrottled) => {
        if (view && view.webContents && !view.webContents.isDestroyed()) {
            view.webContents.setBackgroundThrottling(isThrottled);
        }
    };

    mainWindow.on('hide', () => applyBackgroundThrottling(true));
    mainWindow.on('minimize', () => applyBackgroundThrottling(true));
    mainWindow.on('show', () => {
        const powerSaver = store.get('powerSaverMode', false);
        if (!powerSaver) {
            applyBackgroundThrottling(false);
        }
    });
    mainWindow.on('restore', () => {
        const powerSaver = store.get('powerSaverMode', false);
        if (!powerSaver) {
            applyBackgroundThrottling(false);
        }
    });

    mainWindow.on('close', function (event) {
        if (!isQuiting) {
            event.preventDefault();
            mainWindow.hide();
        }
        return false;
    });

    // Handle external links in default browser (for the View)
    view.webContents.setWindowOpenHandler(({ url }) => {
        const haUrl = store.get('haUrl');
        
        // If it's a popup from the same origin, allow it as a native window
        if (haUrl && url.startsWith(haUrl)) {
            return {
                action: 'allow',
                overrideBrowserWindowOptions: {
                    width: 800,
                    height: 600,
                    autoHideMenuBar: true
                }
            };
        }

        // Security: Only allow http and https protocols for external
        if (url.startsWith('http:') || url.startsWith('https:')) {
            shell.openExternal(url);
        }
        return { action: 'deny' };
    });
}

// ─── Media keys ──────────────────────────────────────────────────────────────

const MEDIA_KEYS = {
    MediaPlayPause: 'media_play_pause',
    MediaNextTrack: 'media_next_track',
    MediaPreviousTrack: 'media_previous_track'
};
// The old default. It isn't an entity (Home Assistant's keyword is plain "all"), so it never
// controlled anything; treat it as unset.
const LEGACY_MEDIA_ENTITY = 'media_player.all';

function getMediaPlayerEntity() {
    const entity = String(store.get('mediaPlayerEntity', '') || '').trim();
    return entity === LEGACY_MEDIA_ENTITY ? '' : entity;
}

async function sendMediaService(service) {
    const haUrl = getCurrentBaseUrl() || getEffectiveUrl();
    const apiToken = await getApiToken();
    const entityId = getMediaPlayerEntity();

    if (!haUrl || !apiToken || !entityId) return;

    const { net } = require('electron');
    const request = net.request({
        method: 'POST',
        url: `${haUrl}/api/services/media_player/${service}`,
        headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
        }
    });

    request.on('response', (response) => {
        response.on('data', () => {});
        response.on('end', () => {});
        response.on('error', () => {});
    });
    request.on('error', (error) => {
        addAppLog('warn', `Media key call failed (${service})`, error.message);
    });
    request.write(JSON.stringify({ entity_id: entityId }));
    request.end();
}

// Media keys are global shortcuts: while registered, other apps (music players, browsers,
// headset buttons) stop receiving them. Only take them when a media player is configured.
function registerMediaKeys() {
    for (const accelerator of Object.keys(MEDIA_KEYS)) globalShortcut.unregister(accelerator);
    if (!getMediaPlayerEntity()) return;
    for (const [accelerator, service] of Object.entries(MEDIA_KEYS)) {
        globalShortcut.register(accelerator, () => sendMediaService(service));
    }
}

function updateViewBounds() {
    if (!mainWindow || !view) return;

    // Title bar height from shell.css; in full screen Home Assistant gets the whole display.
    const titleBarHeight = mainWindow.isFullScreen() ? 0 : 40;

    // With the 'hidden' titleBarStyle the content area includes the title bar, so fill it and
    // offset the top. getSize() would also count the invisible resize borders Windows adds
    // around a maximized window, pushing the view's right and bottom edges off screen.
    const [width, height] = mainWindow.getContentSize();

    view.setBounds({
        x: 0,
        y: titleBarHeight,
        width: width,
        height: height - titleBarHeight
    });

    // Ensure view resizes with window
    view.setAutoResize({ width: true, height: true });
}

function createSetupWindow() {
    const setupWindow = new BrowserWindow({
        width: 600,
        height: 500,
        resizable: false,
        frame: true,
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#0f172a',
            symbolColor: '#ffffff'
        },
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    setupWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Close the setup window when configuration is saved and main window opens
    ipcMain.once('config-saved', () => {
        setupWindow.close();
        createMainWindow();
        // Startup ran without a URL; check the connection now rather than at the next 5-minute tick.
        evaluateSmartConnect().catch(() => {});
        connectHaWebSocket().catch(() => {});
    });
}

ipcMain.handle('run-script', async (event, command) => {
    try {
        const { stdout } = await execPromise(command);
        return { success: true, output: stdout };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

const runStartupScripts = async () => {
    const scripts = store.get('startupScripts', '');
    if (!scripts) return;

    const scriptLines = scripts
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 20);

    if (!scriptLines.length) return;

    const safeMode = store.get('startupScriptsSafeMode', true);
    let approved = true;

    if (safeMode) {
        const response = await dialog.showMessageBox({
            type: 'warning',
            title: 'Startup scripts safe mode',
            message: 'Startup scripts are about to run.',
            detail: `Review before execution:\n\n${scriptLines.join('\n')}`,
            buttons: ['Cancel', 'Run Scripts'],
            defaultId: 0,
            cancelId: 0
        });
        approved = response.response === 1;
    }

    if (!approved) {
        addAppLog('info', 'Startup scripts canceled by user');
        return;
    }

    for (const cmd of scriptLines) {
        if (safeMode && !isStartupScriptSafe(cmd)) {
            addAppLog('warn', 'Blocked unsafe startup script', cmd);
            continue;
        }
        exec(cmd, { windowsHide: true }).unref();
    }
};

app.whenReady().then(async () => {
    const legacyToken = store.get('apiToken', '');
    if (legacyToken) {
        await setApiToken(legacyToken);
    }

    loadServers();

    if (process.platform === 'darwin' && store.get('biometricLock', false)) {
        const { systemPreferences } = require('electron');
        if (systemPreferences.canPromptTouchID()) {
            try {
                await systemPreferences.promptTouchID('Unlock Home Assistant Desktop');
            } catch (e) {
                app.quit();
                return;
            }
        }
    }

    createMainWindow();
    
    // Build Application Menu with Preferences
    const appName = (translations && translations[currentLanguage]) ? t('app.name') : 'Home Assistant Desktop';
    const prefsLabel = (translations && translations[currentLanguage]) ? t('shell.preferences') : 'Preferences';
    
    const template = [
        {
            label: process.platform === 'darwin' ? 'Home Assistant Desktop' : appName,
            submenu: [
                {
                    label: prefsLabel,
                    accelerator: 'CommandOrControl+,',
                    click: () => createPreferencesWindow()
                },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'togglefullscreen' }
            ]
        }
    ];
    
    // Add preferences to Edit menu on non-macOS systems
    if (process.platform !== 'darwin') {
        template[1].submenu.push({ type: 'separator' });
        template[1].submenu.push({
            label: prefsLabel,
            accelerator: 'CommandOrControl+,',
            click: () => createPreferencesWindow()
        });
    }
    
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    console.log('Application menu created with Preferences option');
    
    // On Windows, make menu visible by default. There is no main window yet when the setup
    // wizard opened instead; throwing here would skip the rest of startup (tray, sensors...).
    if (process.platform === 'win32' && mainWindow) {
        mainWindow.setAutoHideMenuBar(false);
        mainWindow.setMenuBarVisibility(true);
    }
    
    startSmartConnectMonitor();
    // Waking up is when the network most often changed (left home, joined another Wi-Fi):
    // re-check then rather than at the next 5-minute health check, once Wi-Fi has reconnected.
    powerMonitor.on('resume', () => {
        setTimeout(() => {
            evaluateSmartConnect().catch((error) => addAppLog('error', 'SmartConnect check after resume failed', error.message));
        }, 10000);
    });
    scheduleSensorReplay();
    runStartupScripts();
    connectHaWebSocket().catch(() => {});

    // Usage of startup settings
    if (store.get('globalShortcut', false)) {
        globalShortcut.register('CommandOrControl+Alt+H', () => {
            if (mainWindow) {
                if (mainWindow.isVisible()) mainWindow.hide();
                else { mainWindow.show(); mainWindow.focus(); }
            }
        });
    }

    startSensorReporting();

    // Jumplist
    if (process.platform === 'win32') {
        app.setUserTasks([
            {
                program: process.execPath,
                arguments: '--quit',
                iconPath: process.execPath,
                iconIndex: 0,
                title: 'Quit App',
                description: 'Quit the application completely'
            }
        ]);
    }

    // System Tray Implementation
    const { nativeImage } = require('electron');
    const iconPath = path.join(__dirname, '../assets/logo.png'); // Use PNG
    console.log('Loading Tray Icon from:', iconPath);

    try {
        let trayIcon = nativeImage.createFromPath(iconPath);
        if (process.platform === 'darwin') {
            trayIcon = trayIcon.resize({ width: 16, height: 16 });
            trayIcon.setTemplateImage(true);
        }
        tray = new Tray(trayIcon);

        updateTrayMenu();

        tray.on('click', () => {
            if (mainWindow) mainWindow.show();
        });
    } catch (e) {
        console.log('Tray icon not found or failed to initialize:', e.message);
    }

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
});

ipcMain.handle('get-settings', async () => {
    const apiToken = await getApiToken();
    return {
        autoLaunch: store.get('autoLaunch', false),
        globalShortcut: store.get('globalShortcut', false),
        autoUpdates: store.get('autoUpdates', true),
        mediaPlayerEntity: getMediaPlayerEntity(),
        customCSS: store.get('customCSS', ''),
        biometricLock: store.get('biometricLock', false),
        startupScripts: store.get('startupScripts', ''),
        haUrl: store.get('haUrl', ''),
        remoteUrl: store.get('remoteUrl', ''),
        useRemote: store.get('useRemote', false),
        smartConnectEnabled: store.get('smartConnectEnabled', true),
        apiToken,
        reportMedia: store.get('reportMedia', true),
        reportDnd: store.get('reportDnd', true),
        reportMic: store.get('reportMic', true),
        reportCamera: store.get('reportCamera', true),
        reportActiveApp: store.get('reportActiveApp', true),
        sensorIntervalMinutes: store.get('sensorIntervalMinutes', 1),
        powerSaverMode: store.get('powerSaverMode', false),
        startupScriptsSafeMode: store.get('startupScriptsSafeMode', true),
        displayScale: normalizeDisplayScale(store.get('displayScale', DEFAULT_DISPLAY_SCALE)),
        shellTheme: store.get('shellTheme', 'system'),
        startupPath: store.get('startupPath', ''),
        hardwareAcceleration: store.get('hardwareAcceleration', true),
        gamepadNavigation: store.get('gamepadNavigation', true),
        appVersion: app.getVersion()
    };
});

ipcMain.handle('save-settings', async (_event, settings) => {
    const displayScale = normalizeDisplayScale(settings.displayScale);
    store.set('haUrl', normalizeUrl(settings.haUrl));
    store.set('remoteUrl', normalizeUrl(settings.remoteUrl));
    store.set('useRemote', settings.useRemote);
    store.set('smartConnectEnabled', settings.smartConnectEnabled !== false);
    store.set('autoLaunch', settings.autoLaunch);
    store.set('globalShortcut', settings.globalShortcut);
    store.set('autoUpdates', settings.autoUpdates);
    store.set('mediaPlayerEntity', String(settings.mediaPlayerEntity || '').trim());
    store.set('customCSS', settings.customCSS);
    store.set('biometricLock', settings.biometricLock);
    store.set('startupScripts', settings.startupScripts);
    await setApiToken(settings.apiToken || '');
    store.set('reportMedia', settings.reportMedia);
    store.set('reportDnd', settings.reportDnd);
    store.set('reportMic', settings.reportMic !== false);
    store.set('reportCamera', settings.reportCamera !== false);
    store.set('reportActiveApp', settings.reportActiveApp !== false);
    store.set('sensorIntervalMinutes', Number(settings.sensorIntervalMinutes || 1));
    store.set('powerSaverMode', !!settings.powerSaverMode);
    store.set('startupScriptsSafeMode', settings.startupScriptsSafeMode !== false);
    store.set('displayScale', displayScale);
    store.set('shellTheme', settings.shellTheme || 'system');
    store.set('startupPath', settings.startupPath || '');
    store.set('hardwareAcceleration', settings.hardwareAcceleration !== false);
    store.set('gamepadNavigation', settings.gamepadNavigation !== false);
    gamepadState.enabled = settings.gamepadNavigation !== false;
    if (!gamepadState.enabled) {
        releaseGamepadKey();
        if (gamepadState.used) queueGamepadCommand({ type: 'hide' });
    }
    sendGamepadState();

    applyShellTheme(settings.shellTheme || 'system');

    if (view && !view.webContents.isDestroyed()) {
        view.webContents.setZoomFactor(displayScale / 100);
    }

    // 1. Auto Launch - Only attempt if packaged to avoid macOS Dev permission errors
    if (app.isPackaged) {
        try {
            app.setLoginItemSettings({
                openAtLogin: settings.autoLaunch,
                path: app.getPath('exe')
            });
        } catch (e) {
            console.warn('Could not set login item settings:', e.message);
        }
    }

    // 2. Global Shortcuts (only the toggle; unregisterAll() would also drop the media keys)
    globalShortcut.unregister('CommandOrControl+Alt+H');
    registerMediaKeys();
    if (settings.globalShortcut) {
        globalShortcut.register('CommandOrControl+Alt+H', () => {
            if (mainWindow) {
                if (mainWindow.isVisible()) mainWindow.hide();
                else { mainWindow.show(); mainWindow.focus(); }
            }
        });
    }

    // 3. Sensors
    await evaluateSmartConnect();
    startSensorReporting();

    return true;
});

ipcMain.on('switch-server', (_event, id) => {
    switchToServer(String(id));
});

ipcMain.handle('get-servers', () => {
    return { servers: store.get('servers', []), activeServerId: store.get('activeServerId', '') };
});

ipcMain.handle('save-servers', (_event, { servers, activeServerId }) => {
    store.set('servers', servers || []);
    if (activeServerId) {
        store.set('activeServerId', activeServerId);
        const active = (servers || []).find(s => s.id === activeServerId);
        if (active) {
            store.set('haUrl', active.localUrl || '');
            store.set('remoteUrl', active.remoteUrl || '');
            store.set('useRemote', active.useRemote || false);
            store.set('smartConnectEnabled', active.smartConnect !== false);
        }
    }
    updateTrayMenu();
    return true;
});

// Picture-in-Picture Window
let pipWindow = null;
ipcMain.on('toggle-pip', () => {
    if (pipWindow) {
        pipWindow.close();
        pipWindow = null;
        return;
    }

    pipWindow = new BrowserWindow({
        width: 320,
        height: 180,
        frame: false,
        alwaysOnTop: true,
        webPreferences: {
            partition: 'persist:homeassistant',
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    pipWindow.loadURL(view.webContents.getURL());
    pipWindow.on('closed', () => { pipWindow = null; });
});

// Quick Controls Floating Desktop Widget
let widgetWindow = null;
function toggleWidgetWindow() {
    if (widgetWindow && !widgetWindow.isDestroyed()) {
        widgetWindow.close();
        widgetWindow = null;
        return;
    }

    widgetWindow = new BrowserWindow({
        width: 320,
        height: 260,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    widgetWindow.loadFile(path.join(__dirname, '../renderer/widget.html'));
    widgetWindow.on('closed', () => { widgetWindow = null; });
}

ipcMain.on('toggle-widget', () => toggleWidgetWindow());

ipcMain.on('open-main-window', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
    }
});

ipcMain.on('trigger-widget-action', (_event, action) => {
    addAppLog('info', `Widget action triggered: ${action.type}`);
    if (action && action.type === 'media') {
        sendMediaService('media_play_pause');
    }
});

// ─── Controller (gamepad) navigation ─────────────────────────────────────────
//
// shell.html reads the controller (gamepad-input.js) and sends commands here. They are carried
// out in the Home Assistant view by gamepad-nav.js, which runs in an isolated JavaScript world:
// it shares the page's DOM but not its globals, so Home Assistant can neither see nor call it,
// and the view still has no preload. Keys that must be trusted (Enter, Escape, slider arrows)
// and scrolling are sent as native input events.

const GAMEPAD_WORLD_ID = 1001; // 0 is the page's own world, 999 is Electron's preload world
const GAMEPAD_COMMANDS = new Set(['navigate', 'press', 'select', 'hold', 'release', 'back', 'menu', 'tab', 'page', 'scroll', 'assist', 'fullscreen']);
const GAMEPAD_KEYS = new Set(['Enter', 'Space', 'Escape', 'Up', 'Down', 'Left', 'Right', 'a']);
const GAMEPAD_ARROW_KEYS = new Set(['Up', 'Down', 'Left', 'Right']);
// Bookkeeping commands main sends itself; they never install the runtime into a page.
const GAMEPAD_INTERNAL_COMMANDS = new Set(['status', 'cancel', 'hide']);
const GAMEPAD_CALL_TIMEOUT_MS = 1500;
const GAMEPAD_TIMED_OUT = Symbol('timed out');
const gamepadState = {
    enabled: store.get('gamepadNavigation', true),
    used: false,
    source: null,
    queue: Promise.resolve(),
    waiting: 0, // commands queued but not started yet
    heldKey: null, // slider arrow key held down by a D-pad direction...
    heldDir: null, // ...and that direction
    focusRect: null,
    refreshTimer: null,
    lastErrorAt: 0
};

// Commands that only let go of things or hide the ring. They always go through, even after the
// window lost focus or the setting was turned off, so that nothing stays held.
const isGamepadCleanup = (command) => command.type === 'release' || command.type === 'cancel' || command.type === 'hide'
    || (command.type === 'navigate' && command.phase === 'release');

function sendGamepadState() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('gamepad-state', {
        enabled: gamepadState.enabled,
        focused: mainWindow.isFocused()
    });
}

function sanitizeGamepadCommand(raw) {
    if (!raw || typeof raw !== 'object' || !GAMEPAD_COMMANDS.has(raw.type)) return null;
    const command = { type: raw.type };
    if (raw.type === 'navigate') {
        if (!['up', 'down', 'left', 'right'].includes(raw.dir)) return null;
        command.dir = raw.dir;
        command.phase = ['press', 'repeat', 'release'].includes(raw.phase) ? raw.phase : 'press';
    } else if (raw.type === 'tab' || raw.type === 'page') {
        command.delta = raw.delta < 0 ? -1 : 1;
    } else if (raw.type === 'scroll') {
        const clamp = (value) => Math.max(-400, Math.min(400, Number(value) || 0));
        command.dx = clamp(raw.dx);
        command.dy = clamp(raw.dy);
    }
    return command;
}

// Runs a command in the page. A page that is being replaced may never answer, so every call gives
// up after a moment instead of stalling the queue (and the controller) for good.
async function runGamepadNav(command) {
    const contents = view.webContents;
    const call = (code) => Promise.race([
        contents.executeJavaScriptInIsolatedWorld(GAMEPAD_WORLD_ID, [{ code }]),
        new Promise((resolve) => setTimeout(() => resolve(GAMEPAD_TIMED_OUT), GAMEPAD_CALL_TIMEOUT_MS))
    ]);
    const run = `globalThis.__hadGamepad ? globalThis.__hadGamepad.run(${JSON.stringify(command)}) : null`;
    let result = await call(run);
    if (result === null && !GAMEPAD_INTERNAL_COMMANDS.has(command.type)) {
        // First command since this page loaded: install the runtime, then retry.
        if (gamepadState.source === null) {
            gamepadState.source = fs.readFileSync(path.join(__dirname, '../renderer/gamepad-nav.js'), 'utf8');
        }
        if (await call(gamepadState.source) !== GAMEPAD_TIMED_OUT) result = await call(run);
    }
    return result && typeof result === 'object' ? result : {};
}

function sendGamepadKey(keyCode, { down = true, up = true, repeat = false } = {}) {
    const contents = view.webContents;
    // Pressing a key needs the view focused; releasing one must not pull the window to the front.
    if (down && !contents.isFocused()) contents.focus();
    const modifiers = repeat ? ['isAutoRepeat'] : [];
    if (down) {
        contents.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
        // Electron sends keyDown as a raw key-down, and Blink only fires keypress (which is what
        // activates buttons and links on Enter) for an explicit char event.
        if (keyCode === 'Enter') contents.sendInputEvent({ type: 'char', keyCode, modifiers });
    }
    if (up) contents.sendInputEvent({ type: 'keyUp', keyCode });
}

// Lets go of a slider arrow key held by the D-pad.
function releaseGamepadKey() {
    if (gamepadState.heldKey && view && !view.webContents.isDestroyed()) {
        sendGamepadKey(gamepadState.heldKey, { down: false });
    }
    gamepadState.heldKey = null;
    gamepadState.heldDir = null;
}

// Back stays within Home Assistant: not back to the login page, nor to the previous server's
// pages after a server switch or a Smart Connect failover.
function canGoBackInHomeAssistant(contents) {
    const history = contents.navigationHistory;
    const index = history.getActiveIndex();
    if (index < 1) return false;
    try {
        const previous = new URL(history.getEntryAtIndex(index - 1).url);
        return previous.origin === new URL(contents.getURL()).origin && !previous.pathname.startsWith('/auth/');
    } catch (_) {
        return false;
    }
}

// Presses the mouse on a card area that has no keyboard focus, at points in view CSS pixels.
// 'down' and 'up' follow the A button, so the card times taps and long presses itself; 'hold' is
// a long press; 'drag' slides from one point to another (stepping a slider card).
async function sendGamepadPointer(phase, [x, y], to) {
    const contents = view.webContents;
    const zoom = contents.getZoomFactor();
    const at = (px, py) => ({ x: Math.round(px * zoom), y: Math.round(py * zoom) });
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const release = (point) => {
        if (contents.isDestroyed()) return;
        contents.sendInputEvent({ type: 'mouseUp', ...point, button: 'left', clickCount: 1 });
        // Move the pointer away again so the card doesn't keep its hover look.
        contents.sendInputEvent({ type: 'mouseLeave', ...point });
    };
    const start = at(x, y);
    if (phase === 'up') {
        release(start);
        return;
    }
    contents.sendInputEvent({ type: 'mouseMove', ...start });
    contents.sendInputEvent({ type: 'mouseDown', ...start, button: 'left', clickCount: 1 });
    if (phase === 'hold') {
        await sleep(650); // past Home Assistant's 500 ms long press
        release(start);
    } else if (phase === 'drag') {
        // Slide in steps, as a finger would: slider cards start sliding on sideways movement.
        const end = at(to[0], to[1]);
        for (let i = 1; i <= 6; i++) {
            await sleep(16);
            if (contents.isDestroyed()) return;
            const stepX = Math.round(start.x + ((end.x - start.x) * i) / 6);
            contents.sendInputEvent({ type: 'mouseMove', x: stepX, y: end.y, modifiers: ['leftButtonDown'] });
        }
        await sleep(16);
        release(end);
    }
}

// Scrolls whatever is under the focused element (or the middle of the view) with a wheel event.
function scrollGamepadView(dx, dy, smooth) {
    const contents = view.webContents;
    const bounds = view.getBounds();
    const zoom = contents.getZoomFactor();
    let x = bounds.width / 2;
    let y = bounds.height / 2;
    if (gamepadState.focusRect) {
        const [left, top, width, height] = gamepadState.focusRect;
        x = (left + width / 2) * zoom;
        y = (top + height / 2) * zoom;
    }
    contents.sendInputEvent({
        type: 'mouseWheel',
        x: Math.round(Math.max(1, Math.min(bounds.width - 2, x))),
        y: Math.round(Math.max(1, Math.min(bounds.height - 2, y))),
        // sendInputEvent wheel deltas point the opposite way to DOM wheel deltas.
        deltaX: -dx,
        deltaY: -dy,
        hasPreciseScrollingDeltas: !smooth,
        canScroll: true
    });
}

async function applyGamepadResult(result, command) {
    if (!view || view.webContents.isDestroyed()) return;
    const rect = result.rect;
    gamepadState.focusRect = Array.isArray(rect) && rect.length === 4 && rect.every(Number.isFinite) ? rect : null;
    let acted = false;

    if (typeof result.key === 'string' && GAMEPAD_KEYS.has(result.key)) {
        // Only a slider's arrow key is held, by the D-pad direction that pressed it.
        if (result.hold && GAMEPAD_ARROW_KEYS.has(result.key) && command.type === 'navigate') {
            releaseGamepadKey();
            gamepadState.heldKey = result.key;
            gamepadState.heldDir = command.dir;
            sendGamepadKey(result.key, { up: false });
        } else {
            sendGamepadKey(result.key);
            acted = true;
        }
    }

    const isPoint = (point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite);
    if (['down', 'up', 'hold', 'drag'].includes(result.pointer) && isPoint(result.at)
        && (result.pointer !== 'drag' || isPoint(result.to))) {
        // Awaited, so the next command can't interleave with a long press or a drag.
        await sendGamepadPointer(result.pointer, result.at, result.to);
        acted = true;
    }

    if (result.history === 'back' && canGoBackInHomeAssistant(view.webContents)) {
        view.webContents.navigationHistory.goBack();
        acted = true;
    }

    // Nothing more to focus that way: scroll instead, to reveal non-interactive content.
    const step = view.getBounds().height * 0.4;
    switch (result.scroll) {
        case 'up': scrollGamepadView(0, -step, true); break;
        case 'down': scrollGamepadView(0, step, true); break;
        case 'left': scrollGamepadView(-step, 0, true); break;
        case 'right': scrollGamepadView(step, 0, true); break;
        default: break;
    }

    // A key or click may have opened a dialog or moved focus: aim scrolling at the middle of the
    // view until the page reports where focus ended up.
    if (acted) {
        gamepadState.focusRect = null;
        clearTimeout(gamepadState.refreshTimer);
        gamepadState.refreshTimer = setTimeout(() => queueGamepadCommand({ type: 'status' }), 500);
    }

    if (typeof result.error === 'string' && Date.now() - gamepadState.lastErrorAt > 10000) {
        gamepadState.lastErrorAt = Date.now();
        addAppLog('warn', 'Controller navigation error', result.error);
    }
}

async function performGamepadCommand(command) {
    if (!view || view.webContents.isDestroyed() || !mainWindow || mainWindow.isDestroyed()) return;
    // Checked again when the command runs, not only when it arrived: a queued Enter must not act
    // (and pull the app to the front) after the user switched to another window.
    const allowed = () => isGamepadCleanup(command) || (gamepadState.enabled && mainWindow.isFocused());
    if (!allowed()) return;
    if (command.type === 'navigate') {
        if (gamepadState.heldKey) {
            if (command.dir === gamepadState.heldDir && command.phase !== 'press') {
                // A slider owns this direction: repeat its arrow key, let go with the D-pad.
                if (command.phase === 'repeat') sendGamepadKey(gamepadState.heldKey, { up: false, repeat: true });
                else releaseGamepadKey();
                return;
            }
            releaseGamepadKey(); // another direction took over
        }
        if (command.phase === 'release') return;
    }
    // A page that is still loading can't be navigated; skip rather than replay presses later.
    if (!isGamepadCleanup(command) && view.webContents.isLoadingMainFrame()) return;
    const result = await runGamepadNav(command);
    if (!allowed() || view.webContents.isDestroyed()) return;
    await applyGamepadResult(result, command);
}

// Commands run in order, since each starts from wherever the previous one moved focus.
function queueGamepadCommand(command) {
    // A held D-pad repeats every 110 ms. When the page answers slower than that, drop repeats
    // instead of letting them pile up and keep moving focus after the D-pad is released.
    if (command.type === 'navigate' && command.phase === 'repeat' && gamepadState.waiting > 0) return;
    gamepadState.waiting++;
    gamepadState.queue = gamepadState.queue
        .then(() => {
            gamepadState.waiting--;
            return performGamepadCommand(command);
        })
        .catch((error) => {
            if (Date.now() - gamepadState.lastErrorAt > 10000) {
                gamepadState.lastErrorAt = Date.now();
                addAppLog('warn', 'Controller command failed', error.message);
            }
        });
}

function handleGamepadCommand(command) {
    if (!view || view.webContents.isDestroyed()) return;
    gamepadState.used = true;
    if (command.type === 'fullscreen') {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
        return;
    }
    if (command.type === 'scroll') {
        scrollGamepadView(command.dx, command.dy, false);
        return;
    }
    if (command.type === 'page') {
        scrollGamepadView(0, command.delta * view.getBounds().height * 0.8, true);
        return;
    }
    queueGamepadCommand(command);
}

ipcMain.on('gamepad-command', (event, raw) => {
    if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) return;
    const command = sanitizeGamepadCommand(raw);
    if (!command) return;
    if (!isGamepadCleanup(command) && (!gamepadState.enabled || !mainWindow.isFocused())) return;
    handleGamepadCommand(command);
});

function applyShellTheme(theme) {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const effectiveTheme = theme || store.get('shellTheme', 'system');

    try {
        if (process.platform === 'darwin') {
            if (effectiveTheme === 'frosted') {
                mainWindow.setVibrancy('under-window');
            } else {
                mainWindow.setVibrancy(null);
            }
        } else if (process.platform === 'win32') {
            if (effectiveTheme === 'frosted' && typeof mainWindow.setBackgroundMaterial === 'function') {
                mainWindow.setBackgroundMaterial('acrylic');
            }
        }
    } catch (_) {}

    if (mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('shell-theme-changed', effectiveTheme);
    }
}


function getBatteryInfo() {
    return new Promise((resolve) => {
        if (process.platform === 'darwin') {
            exec('pmset -g batt', (error, stdout) => {
                if (error || !stdout) return resolve(null);
                const match = stdout.match(/(\d+)%;\s(.*?);\s(?:(\d+:\d+)\sremaining|(\(no estimate\)))/);
                if (match) {
                    resolve({
                        percent: parseInt(match[1]),
                        status: match[2],
                        timeRemaining: match[3] || 'Calculating'
                    });
                } else {
                    // Simple fallback if regex fails
                    const percentMatch = stdout.match(/(\d+)%/);
                    resolve(percentMatch ? { percent: parseInt(percentMatch[1]), status: 'unknown', timeRemaining: 'N/A' } : null);
                }
            });
        } else if (process.platform === 'win32') {
            const script = 'powershell -command "Get-WmiObject -Class Win32_Battery | Select-Object -First 1 | ForEach-Object { \\"$($_.EstimatedChargeRemaining),$($_.BatteryStatus),$($_.EstimatedRunTime)\\" }"';
            exec(script, { windowsHide: true }, (error, stdout) => {
                if (error || !stdout) return resolve(null);
                const parts = stdout.trim().split(',');
                if (parts.length < 2) return resolve(null);
                const percent = parseInt(parts[0]);
                const statusCode = parts[1];
                const time = parts[2];
                resolve({
                    percent: percent,
                    status: statusCode === '2' ? 'charging' : (statusCode === '1' ? 'discharging' : 'unknown'),
                    timeRemaining: (time && time !== '715827882') ? `${Math.floor(time/60)}:${time%60}` : 'Calculating'
                });
            });
        } else if (process.platform === 'linux') {
            try {
                const devices = fs.readdirSync('/sys/class/power_supply/');
                const batteryDevice = devices.find(d => d.startsWith('BAT'));
                if (batteryDevice) {
                    const capacity = fs.readFileSync(`/sys/class/power_supply/${batteryDevice}/capacity`, 'utf8').trim();
                    const status = fs.readFileSync(`/sys/class/power_supply/${batteryDevice}/status`, 'utf8').trim().toLowerCase();
                    resolve({
                        percent: parseInt(capacity),
                        status: status,
                        timeRemaining: 'Calculating'
                    });
                } else {
                    resolve(null);
                }
            } catch (e) {
                resolve(null);
            }
        } else {
            resolve(null);
        }
    });
}

function getActiveApp() {
    return new Promise((resolve) => {
        if (process.platform === 'darwin') {
            const script = 'tell application "System Events" to get name of first process whose frontmost is true';
            execFile('osascript', ['-e', script], (error, stdout) => {
                resolve(error ? 'Unknown' : stdout.trim());
            });
        } else if (process.platform === 'win32') {
            const script = 'powershell -command "(Get-Process | Where-Object { $_.MainWindowHandle -ne 0 } | Sort-Object -Property LastAccessTime -Descending | Select-Object -First 1).ProcessName"';
            exec(script, { windowsHide: true }, (error, stdout) => {
                resolve(error ? 'Unknown' : stdout.trim());
            });
        } else {
            resolve('Linux Desktop');
        }
    });
}

function getMicCameraStatus() {
    return new Promise((resolve) => {
        if (process.platform === 'darwin') {
            // Check if any process is using CMCapture (Camera)
            exec("log show --last 1m --predicate 'subsystem == \"com.apple.CMCapture\" AND eventMessage CONTAINS \"Post-Deployment\"'", (error, stdout) => {
                const camUsed = !error && stdout.includes('camera');
                resolve({ mic: false, cam: camUsed }); // Mic is harder on Mac without specialized tools
            });
        } else if (process.platform === 'win32') {
            const script = `powershell -Command "
                $reg = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\webcam';
                $cam = (Get-ItemProperty $reg -ErrorAction SilentlyContinue).LastUsedTimeStop -eq 0;
                $regMic = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone';
                $mic = (Get-ItemProperty $regMic -ErrorAction SilentlyContinue).LastUsedTimeStop -eq 0;
                Write-Output \\"$cam,$mic\\" "`;
            exec(script, { windowsHide: true }, (error, stdout) => {
                if (error || !stdout) return resolve({ mic: false, cam: false });
                const [cam, mic] = stdout.trim().split(',').map(v => v === 'True');
                resolve({ mic, cam });
            });
        } else {
            resolve({ mic: false, cam: false });
        }
    });
}

function getDNDStatus() {
    return new Promise((resolve) => {
        if (process.platform === 'darwin') {
            exec('defaults read com.apple.controlcenter FocusModes', (error, stdout) => {
                resolve(!error && stdout.includes('1')); 
            });
        } else if (process.platform === 'win32') {
            exec('powershell -Command "(Get-ItemProperty HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings).NOC_GLOBAL_SETTING_TOASTS_ENABLED"', { windowsHide: true }, (error, stdout) => {
                resolve(stdout.trim() === '0');
            });
        } else {
            resolve(false);
        }
    });
}

function getEffectiveUrl() {
    const haUrl = store.get('haUrl');
    const remoteUrl = store.get('remoteUrl');
    const useRemote = store.get('useRemote', false);
    return (useRemote && remoteUrl) ? remoteUrl : haUrl;
}

function handleDeepLink(url) {
    if (!view) return;
    const rawPath = url.replace('ha-desktop://', '');
    const haUrl = getCurrentBaseUrl() || getEffectiveUrl();
    if (!haUrl) return;
    try {
        const target = new URL(rawPath, haUrl);
        if (target.origin !== new URL(haUrl).origin) return;
        view.webContents.loadURL(target.href);
    } catch (_) { /* invalid URL, ignore */ }
}

function getSensorBaseIntervalMs() {
    const selected = Number(store.get('sensorIntervalMinutes', 1));
    if (selected === 5) return 5 * 60 * 1000;
    if (selected === 15) return 15 * 60 * 1000;
    return 60 * 1000;
}

async function getEffectiveSensorIntervalMs() {
    let intervalMs = getSensorBaseIntervalMs();
    const idleSeconds = powerMonitor.getSystemIdleTime();
    const powerSaverMode = store.get('powerSaverMode', false);

    if (idleSeconds >= 900) {
        intervalMs = Math.max(intervalMs, 5 * 60 * 1000);
    }

    if (powerSaverMode) {
        const battery = await getBatteryInfo();
        if (battery && battery.status !== 'charging') {
            intervalMs = Math.max(intervalMs, 15 * 60 * 1000);
        }
    }

    return intervalMs;
}

async function postSensor(baseUrl, token, entityId, data) {
    const { net } = require('electron');

    return new Promise((resolve) => {
        const request = net.request({
            method: 'POST',
            url: `${baseUrl}/api/states/${entityId}`,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        request.on('response', (response) => {
            const code = response.statusCode || 0;
            response.on('data', () => {});
            response.on('end', () => resolve({ ok: code >= 200 && code < 300, code }));
            response.on('error', () => resolve({ ok: false, code }));
        });
        request.on('error', (error) => {
            resolve({ ok: false, message: error.message });
        });

        request.write(JSON.stringify(data));
        request.end();
    });
}

async function reportSensor(baseUrl, token, entityId, data) {
    const result = await postSensor(baseUrl, token, entityId, data);
    if (!result.ok) {
        enqueueSensorReport(baseUrl, token, entityId, data);
    }
}

function startSensorReporting() {
    if (sensorTickTimer) clearTimeout(sensorTickTimer);
    const generation = ++sensorGeneration;

    let uniqueId = 'unknown_pc';
    try {
        uniqueId = machineIdSync();
    } catch (error) {
        addAppLog('warn', 'Failed to get machine id, using fallback', error.message);
        const uuidFallback = store.get('uuidFallback');
        if (uuidFallback) {
            uniqueId = uuidFallback;
        } else {
            uniqueId = require('crypto').randomUUID();
            store.set('uuidFallback', uniqueId);
        }
    }

    let previousCpuInfo = getCpuInfo();

    const tick = async () => {
        if (sensorGeneration !== generation) return;
        try {
            const haUrl = getCurrentBaseUrl() || getEffectiveUrl();
            const apiToken = await getApiToken();
            if (!haUrl || !apiToken) {
                if (sensorGeneration === generation) sensorTickTimer = setTimeout(tick, 30000);
                return;
            }

            const effectiveInterval = await getEffectiveSensorIntervalMs();
            const enoughTimeElapsed = (Date.now() - lastSensorReportAt) >= effectiveInterval;
            if (!enoughTimeElapsed) {
                if (sensorGeneration === generation) sensorTickTimer = setTimeout(tick, 30000);
                return;
            }

            const currentCpuInfo = getCpuInfo();
            const idleDifference = currentCpuInfo.idle - previousCpuInfo.idle;
            const totalDifference = currentCpuInfo.total - previousCpuInfo.total;

            let cpuPercent = 0;
            if (totalDifference > 0) {
                cpuPercent = Math.max(0, Math.min(100, Math.round(100 - (100 * idleDifference / totalDifference))));
            }
            previousCpuInfo = currentCpuInfo;

            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            const memPercent = Math.round((usedMem / totalMem) * 100);
            const safeHostname = os.hostname().toLowerCase().replace(/[^a-z0-9_]/g, '_');

            const reportDnd = store.get('reportDnd', true);
            const reportActiveApp = store.get('reportActiveApp', true);
            const reportMedia = store.get('reportMedia', true);
            const reportMic = store.get('reportMic', true);
            const reportCamera = store.get('reportCamera', true);

            // Gather all OS data in parallel before sending
            const [activeApp, dndStatus, mediaStatus, batteryInfo] = await Promise.all([
                reportActiveApp ? getActiveApp() : Promise.resolve('hidden'),
                reportDnd ? getDNDStatus() : Promise.resolve(false),
                reportMedia ? getMicCameraStatus() : Promise.resolve({ mic: false, cam: false }),
                getBatteryInfo()
            ]);

            const cameraActive = reportCamera ? mediaStatus.cam : false;
            const micActive = reportMic ? mediaStatus.mic : false;
            const hostname = os.hostname();

            const sends = [
                reportSensor(haUrl, apiToken, `sensor.${safeHostname}_desktop_memory_usage`, {
                    state: memPercent,
                    attributes: {
                        friendly_name: `${hostname} Memory Usage`,
                        unit_of_measurement: '%',
                        icon: 'mdi:memory',
                        total_memory_gb: (totalMem / (1024 ** 3)).toFixed(2),
                        free_memory_gb: (freeMem / (1024 ** 3)).toFixed(2),
                        unique_id: `${uniqueId}_memory`
                    }
                }),
                reportSensor(haUrl, apiToken, `sensor.${safeHostname}_desktop_cpu_usage`, {
                    state: cpuPercent,
                    attributes: {
                        friendly_name: `${hostname} CPU Usage`,
                        unit_of_measurement: '%',
                        icon: 'mdi:cpu-64-bit',
                        unique_id: `${uniqueId}_cpu`
                    }
                }),
                reportSensor(haUrl, apiToken, `sensor.${safeHostname}_desktop_status`, {
                    state: 'Active',
                    attributes: {
                        friendly_name: `${hostname} Status`,
                        hostname: hostname,
                        platform: os.platform(),
                        arch: os.arch(),
                        uptime_hours: (os.uptime() / 3600).toFixed(2),
                        is_idle: powerMonitor.getSystemIdleState(300) === 'idle',
                        active_app: activeApp,
                        dnd_mode: dndStatus,
                        icon: 'mdi:desktop-tower',
                        unique_id: `${uniqueId}_status`
                    }
                }),
                reportSensor(haUrl, apiToken, `sensor.${safeHostname}_desktop_uptime`, {
                    state: (os.uptime() / 3600).toFixed(2),
                    attributes: {
                        friendly_name: `${hostname} Uptime`,
                        unit_of_measurement: 'h',
                        icon: 'mdi:clock-outline',
                        unique_id: `${uniqueId}_uptime`
                    }
                })
            ];

            if (reportMedia) {
                sends.push(reportSensor(haUrl, apiToken, `sensor.${safeHostname}_desktop_media_status`, {
                    state: cameraActive || micActive ? 'In Use' : 'Idle',
                    attributes: {
                        friendly_name: `${hostname} Media Activity`,
                        camera_active: cameraActive,
                        microphone_active: micActive,
                        icon: cameraActive ? 'mdi:camera' : (micActive ? 'mdi:microphone' : 'mdi:camera-off'),
                        unique_id: `${uniqueId}_media`
                    }
                }));
            }

            if (batteryInfo) {
                sends.push(reportSensor(haUrl, apiToken, `sensor.${safeHostname}_desktop_battery`, {
                    state: batteryInfo.percent,
                    attributes: {
                        friendly_name: `${hostname} Battery`,
                        unit_of_measurement: '%',
                        icon: batteryInfo.status === 'charging' ? 'mdi:battery-charging' : 'mdi:battery',
                        status: batteryInfo.status,
                        unique_id: `${uniqueId}_battery`
                    }
                }));
            }

            await Promise.all(sends);

            await flushSensorQueue();
            lastSensorReportAt = Date.now();
        } catch (error) {
            addAppLog('error', 'Sensor reporting tick failed', error.message);
        } finally {
            if (sensorGeneration === generation) sensorTickTimer = setTimeout(tick, 30000);
        }
    };

    tick();
}

function getCpuInfo() {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;

    for (const cpu of cpus) {
        for (const type in cpu.times) {
            total += cpu.times[type];
        }
        idle += cpu.times.idle;
    }

    return { idle, total };
}

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// The close button only hides the main window, so a real quit (the Quit menu item, Cmd+Q,
// installing an update) has to get past that. Update installs close the windows before
// before-quit fires, hence the autoUpdater event as well.
app.on('before-quit', () => { isQuiting = true; });
autoUpdater.on('before-quit-for-update', () => { isQuiting = true; });

app.on('will-quit', () => {
    if (smartConnectState.timer) clearInterval(smartConnectState.timer);
    if (sensorDeliveryState.replayTimer) clearInterval(sensorDeliveryState.replayTimer);
    if (sensorTickTimer) clearTimeout(sensorTickTimer);
    if (haWsManager.reconnectTimer) clearTimeout(haWsManager.reconnectTimer);
    if (haWsManager.ws) { haWsManager.ws.onclose = null; try { haWsManager.ws.close(); } catch (_) {} }
    globalShortcut.unregisterAll();
});

function createPreferencesWindow() {
    const prefWindow = new BrowserWindow({
        width: 650,
        height: 580,
        parent: mainWindow,
        modal: false,
        autoHideMenuBar: true,
        icon: path.join(__dirname, '../assets/logo.png'),
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#0f172a',
            symbolColor: '#ffffff',
            height: 30
        },
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload-prefs.js')
        }
    });
    prefWindow.loadFile(path.join(__dirname, '../renderer/preferences.html'));
}

ipcMain.handle('save-config', (event, url) => {
    let validUrl = url;
    if (!/^https?:\/\//i.test(validUrl)) {
        validUrl = 'http://' + validUrl;
    }
    store.set('haUrl', validUrl);
    return true;
});

ipcMain.handle('save-onboarding-config', async (_event, payload) => {
    const localUrl = normalizeUrl(payload.localUrl || '');
    const remoteUrl = normalizeUrl(payload.remoteUrl || '');
    if (!localUrl) {
        throw new Error('Local URL is required');
    }

    store.set('haUrl', localUrl);
    store.set('remoteUrl', remoteUrl);
    store.set('useRemote', false);
    store.set('smartConnectEnabled', true);

    if (payload.token) {
        await setApiToken(payload.token);
    }
    addAppLog('info', 'Onboarding settings saved');
    return true;
});

ipcMain.handle('test-ha-connection', async (_event, payload) => {
    const token = (payload && payload.token) ? payload.token : '';
    return testHaConnection(payload ? payload.url : '', token);
});

ipcMain.handle('reset-config', async (event) => {
    // The button sits next to Preferences; one stray tap shouldn't wipe the connection.
    const parent = BrowserWindow.fromWebContents(event.sender);
    const options = {
        type: 'warning',
        buttons: [t('shell.cancel'), t('shell.disconnectButton')],
        defaultId: 0,
        cancelId: 0,
        message: t('shell.disconnectConfirm'),
        detail: t('shell.disconnectConfirmDetail')
    };
    const { response } = parent ? await dialog.showMessageBox(parent, options) : await dialog.showMessageBox(options);
    if (response !== 1) return false;
    store.delete('haUrl');
    app.relaunch();
    app.exit(0);
});



ipcMain.on('open-preferences', () => {
    createPreferencesWindow();
});

ipcMain.handle('get-error-logs', () => {
    return [...appLogBuffer].reverse();
});

ipcMain.handle('export-error-logs', async () => {
    const result = await dialog.showSaveDialog({
        title: 'Export logs',
        defaultPath: `ha-desktop-logs-${Date.now()}.txt`,
        filters: [{ name: 'Text', extensions: ['txt'] }]
    });

    if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
    }

    const contents = appLogBuffer
        .map((entry) => `${entry.timestamp} [${entry.level.toUpperCase()}] ${entry.message}${entry.details ? ` | ${entry.details}` : ''}`)
        .join('\n');

    fs.writeFileSync(result.filePath, contents, 'utf8');
    return { success: true, filePath: result.filePath };
});

ipcMain.on('open-external', (event, url) => {
    if (typeof url === 'string' && (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:'))) {
        shell.openExternal(url);
    }
});

// ─── Theme Directory Scanner Engine ──────────────────────────────────────────

function scanThemes() {
    const themes = [];
    const builtInDir = path.join(__dirname, '../themes');
    const userDir = path.join(app.getPath('userData'), 'themes');

    if (!fs.existsSync(userDir)) {
        try { fs.mkdirSync(userDir, { recursive: true }); } catch (_) {}
    }

    const readThemeDir = (dirPath, isUserCustom = false) => {
        if (!fs.existsSync(dirPath)) return;
        try {
            const files = fs.readdirSync(dirPath);
            for (const file of files) {
                if (file.endsWith('.css')) {
                    const filePath = path.join(dirPath, file);
                    const content = fs.readFileSync(filePath, 'utf8');
                    const titleMatch = content.match(/Theme:\s*(.+)/i);
                    const rawName = titleMatch ? titleMatch[1].trim() : file.replace('.css', '').replace(/[-_]/g, ' ');
                    const displayName = (isUserCustom ? '👤 ' : '🎨 ') + rawName;
                    themes.push({
                        id: file,
                        name: displayName,
                        file,
                        content,
                        isUserCustom,
                        path: filePath
                    });
                }
            }
        } catch (e) {
            addAppLog('warn', `Failed reading theme directory ${dirPath}`, e.message);
        }
    };

    readThemeDir(builtInDir, false);
    readThemeDir(userDir, true);

    return themes;
}

ipcMain.handle('get-available-themes', () => {
    return scanThemes();
});

ipcMain.handle('get-user-themes-path', () => {
    const userDir = path.join(app.getPath('userData'), 'themes');
    if (!fs.existsSync(userDir)) {
        try { fs.mkdirSync(userDir, { recursive: true }); } catch (_) {}
    }
    return userDir;
});

