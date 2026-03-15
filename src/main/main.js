const { app, BrowserWindow, BrowserView, ipcMain, shell, Tray, Menu, globalShortcut, nativeTheme, powerMonitor, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
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

const smartConnectState = {
    healthIntervalMs: 20000,
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

let mainWindow;
let view;
let tray;
let isQuiting = false;
let sensorTickTimer;
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


// Initialize Auto Updater
const { updateElectronApp } = require('update-electron-app');
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
                resolve({ ok, code, authRequired });
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
        return { ok: false, message: 'URL manquante.' };
    }

    try {
        new URL(normalized);
    } catch (_error) {
        return { ok: false, message: 'URL invalide.' };
    }

    const result = await Promise.race([
        healthCheckRequest(normalized, token),
        timeoutPromise(7000)
    ]);

    if (result.timeout) {
        return { ok: false, message: 'Timeout: instance non joignable.' };
    }

    if (!result.ok) {
        if (result.message && /certificate|ssl|tls/i.test(result.message)) {
            return { ok: false, message: 'Échec certificat SSL/TLS.' };
        }
        return { ok: false, message: `Connexion impossible (${result.message || 'network error'}).` };
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

function createMainWindow() {
    const haUrl = getCurrentBaseUrl() || getEffectiveUrl();

    if (!haUrl) {
        createSetupWindow();
        return;
    }

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
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

    // Load the shell (custom title bar)
    mainWindow.loadFile(path.join(__dirname, '../renderer/shell.html'));

    // Create BrowserView for Home Assistant Content
    view = new BrowserView({
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            partition: 'persist:homeassistant' // Critical for saving login session
        }
    });

    mainWindow.setBrowserView(view);

    const displayScale = normalizeDisplayScale(store.get('displayScale', DEFAULT_DISPLAY_SCALE));
    view.webContents.setZoomFactor(displayScale / 100);

    view.webContents.on('did-fail-load', (_event, _errorCode, errorDescription, _validatedURL) => {
        addAppLog('warn', 'BrowserView failed to load page', errorDescription);
        smartConnectState.currentTarget = 'offline';
        emitNetworkStatus();
    });

    // Initial bounds setting
    updateViewBounds();

    // Dark Mode Sync
    const syncTheme = () => {
        const isDark = nativeTheme.shouldUseDarkColors;
        view.webContents.executeJavaScript(`
            if (document.querySelector('home-assistant')) {
                const ha = document.querySelector('home-assistant');
                if (ha.saveTokens) {
                    // Force HA theme if possible, or just let it react to (prefers-color-scheme)
                    console.log('Syncing theme with OS: ' + (isDark ? 'dark' : 'light'));
                }
            }
        `);
    };

    nativeTheme.on('updated', syncTheme);
    view.webContents.on('did-finish-load', () => {
        syncTheme();
        const customCSS = store.get('customCSS', '');
        if (customCSS) {
            view.webContents.insertCSS(customCSS);
        }
    });

    // Media Keys Integration
    const sendMediaService = async (service) => {
        const haUrl = getCurrentBaseUrl() || getEffectiveUrl();
        const apiToken = await getApiToken();
        const entityId = store.get('mediaPlayerEntity', 'media_player.all'); // Fallback or user-defined

        if (!haUrl || !apiToken) return;

        const { net } = require('electron');
        const request = net.request({
            method: 'POST',
            url: `${haUrl}/api/services/media_player/${service}`,
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
            }
        });

        request.on('error', (error) => {
            addAppLog('warn', `Media key call failed (${service})`, error.message);
        });
        request.write(JSON.stringify({ entity_id: entityId }));
        request.end();
    };

    globalShortcut.register('MediaPlayPause', () => sendMediaService('media_play_pause'));
    globalShortcut.register('MediaNextTrack', () => sendMediaService('media_next_track'));
    globalShortcut.register('MediaPreviousTrack', () => sendMediaService('media_previous_track'));

    // Context Menu Implementation
    view.webContents.on('context-menu', (event, params) => {
        const menu = Menu.buildFromTemplate([
            { label: 'Back', enabled: view.webContents.canGoBack(), click: () => view.webContents.goBack() },
            { label: 'Forward', enabled: view.webContents.canGoForward(), click: () => view.webContents.goForward() },
            { label: 'Reload', click: () => view.webContents.reload() },
            { type: 'separator' },
            { label: 'Copy Image Address', visible: params.mediaType === 'image', click: () => require('electron').clipboard.writeText(params.srcURL) }, // Fixed clipboard import
            { label: 'Inspect Element', click: () => view.webContents.inspectElement(params.x, params.y) }
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

    // Load HA URL into the view
    view.webContents.loadURL(haUrl);
    emitNetworkStatus();

    // Handle Resize
    mainWindow.on('resize', updateViewBounds);
    mainWindow.on('maximize', updateViewBounds);
    mainWindow.on('unmaximize', updateViewBounds);
    mainWindow.on('enter-full-screen', updateViewBounds);
    mainWindow.on('leave-full-screen', updateViewBounds);


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

function updateViewBounds() {
    if (!mainWindow || !view) return;
    const bounds = mainWindow.getBounds();
    const contentBounds = mainWindow.getContentBounds();

    // Title bar height from shell.css is 32px
    const titleBarHeight = 40;

    // We strive to fill the window below the title bar
    // Note: on Windows with 'hidden' titleBarStyle, getContentBounds might include the title bar area
    // So we just use the window size and offset top.
    const [width, height] = mainWindow.getSize();

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
        exec(cmd).unref();
    }
};

app.whenReady().then(async () => {
    const legacyToken = store.get('apiToken', '');
    if (legacyToken) {
        await setApiToken(legacyToken);
    }

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
    startSmartConnectMonitor();
    scheduleSensorReplay();
    runStartupScripts();

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

        const contextMenu = Menu.buildFromTemplate([
            { label: 'Show App', click: () => mainWindow && mainWindow.show() },
            { type: 'separator' },
            {
                label: 'Support the Project (☕)', click: () => {
                    shell.openExternal('https://buymeacoffee.com/nexos20');
                }
            },
            { type: 'separator' },
            {
                label: 'Reset Configuration', click: () => {
                    store.delete('haUrl');
                    app.relaunch();
                    app.exit(0);
                }
            },
            { type: 'separator' },
            {
                label: 'Quit', click: () => {
                    isQuiting = true;
                    app.quit();
                }
            }
        ]);
        tray.setToolTip('Home Assistant Desktop');
        tray.setContextMenu(contextMenu);

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
        mediaPlayerEntity: store.get('mediaPlayerEntity', 'media_player.all'),
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
    store.set('mediaPlayerEntity', settings.mediaPlayerEntity);
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

    // 2. Global Shortcut
    globalShortcut.unregisterAll();
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
            partition: 'persist:homeassistant'
        }
    });

    pipWindow.loadURL(view.webContents.getURL());
    pipWindow.on('closed', () => { pipWindow = null; });
});


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
            exec(script, (error, stdout) => {
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
            exec(`osascript -e '${script}'`, (error, stdout) => {
                resolve(error ? 'Unknown' : stdout.trim());
            });
        } else if (process.platform === 'win32') {
            const script = 'powershell -command "(Get-Process | Where-Object { $_.MainWindowHandle -ne 0 } | Sort-Object -Property LastAccessTime -Descending | Select-Object -First 1).ProcessName"';
            exec(script, (error, stdout) => {
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
            exec(script, (error, stdout) => {
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
            exec('powershell -Command "(Get-ItemProperty HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings).NOC_GLOBAL_SETTING_TOASTS_ENABLED"', (error, stdout) => {
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
    const path = url.replace('ha-desktop://', '');
    const haUrl = getCurrentBaseUrl() || getEffectiveUrl();
    view.webContents.loadURL(`${haUrl}/${path}`);
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
            resolve({ ok: code >= 200 && code < 300, code });
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
        try {
            const haUrl = getCurrentBaseUrl() || getEffectiveUrl();
            const apiToken = await getApiToken();
            if (!haUrl || !apiToken) {
                sensorTickTimer = setTimeout(tick, 30000);
                return;
            }

            const effectiveInterval = await getEffectiveSensorIntervalMs();
            const enoughTimeElapsed = (Date.now() - lastSensorReportAt) >= effectiveInterval;
            if (!enoughTimeElapsed) {
                sensorTickTimer = setTimeout(tick, 30000);
                return;
            }

            const currentCpuInfo = getCpuInfo();
            const idleDifference = currentCpuInfo.idle - previousCpuInfo.idle;
            const totalDifference = currentCpuInfo.total - previousCpuInfo.total;

            let cpuPercent = 0;
            if (totalDifference > 0) {
                cpuPercent = Math.round(100 - (100 * idleDifference / totalDifference));
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

            const activeApp = reportActiveApp ? await getActiveApp() : 'hidden';

            await reportSensor(haUrl, apiToken, `sensor.${safeHostname}_desktop_memory_usage`, {
                state: memPercent,
                attributes: {
                    friendly_name: `${os.hostname()} Memory Usage`,
                    unit_of_measurement: '%',
                    icon: 'mdi:memory',
                    total_memory_gb: (totalMem / (1024 ** 3)).toFixed(2),
                    free_memory_gb: (freeMem / (1024 ** 3)).toFixed(2),
                    unique_id: `${uniqueId}_memory`
                }
            });

            await reportSensor(haUrl, apiToken, `sensor.${safeHostname}_desktop_cpu_usage`, {
                state: cpuPercent,
                attributes: {
                    friendly_name: `${os.hostname()} CPU Usage`,
                    unit_of_measurement: '%',
                    icon: 'mdi:cpu-64-bit',
                    unique_id: `${uniqueId}_cpu`
                }
            });

            await reportSensor(haUrl, apiToken, `sensor.${safeHostname}_desktop_status`, {
                state: 'Active',
                attributes: {
                    friendly_name: `${os.hostname()} Status`,
                    hostname: os.hostname(),
                    platform: os.platform(),
                    arch: os.arch(),
                    uptime_hours: (os.uptime() / 3600).toFixed(2),
                    is_idle: powerMonitor.getSystemIdleState(300) === 'idle',
                    active_app: activeApp,
                    dnd_mode: reportDnd ? await getDNDStatus() : false,
                    icon: 'mdi:desktop-tower',
                    unique_id: `${uniqueId}_status`
                }
            });

            if (reportMedia) {
                const mediaStatus = await getMicCameraStatus();
                const cameraActive = reportCamera ? mediaStatus.cam : false;
                const micActive = reportMic ? mediaStatus.mic : false;
                await reportSensor(haUrl, apiToken, `sensor.${safeHostname}_desktop_media_status`, {
                    state: cameraActive || micActive ? 'In Use' : 'Idle',
                    attributes: {
                        friendly_name: `${os.hostname()} Media Activity`,
                        camera_active: cameraActive,
                        microphone_active: micActive,
                        icon: cameraActive ? 'mdi:camera' : (micActive ? 'mdi:microphone' : 'mdi:camera-off'),
                        unique_id: `${uniqueId}_media`
                    }
                });
            }

            await reportSensor(haUrl, apiToken, `sensor.${safeHostname}_desktop_uptime`, {
                state: (os.uptime() / 3600).toFixed(2),
                attributes: {
                    friendly_name: `${os.hostname()} Uptime`,
                    unit_of_measurement: 'h',
                    icon: 'mdi:clock-outline',
                    unique_id: `${uniqueId}_uptime`
                }
            });

            const batteryInfo = await getBatteryInfo();
            if (batteryInfo) {
                await reportSensor(haUrl, apiToken, `sensor.${safeHostname}_desktop_battery`, {
                    state: batteryInfo.percent,
                    attributes: {
                        friendly_name: `${os.hostname()} Battery`,
                        unit_of_measurement: '%',
                        icon: batteryInfo.status === 'charging' ? 'mdi:battery-charging' : 'mdi:battery',
                        status: batteryInfo.status,
                        unique_id: `${uniqueId}_battery`
                    }
                });
            }

            await flushSensorQueue();
            lastSensorReportAt = Date.now();
        } catch (error) {
            addAppLog('error', 'Sensor reporting tick failed', error.message);
        } finally {
            sensorTickTimer = setTimeout(tick, 30000);
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

function reportSensor(baseUrl, token, entityId, data) {
    const { net } = require('electron');
    const request = net.request({
        method: 'POST',
        url: `${baseUrl}/api/states/${entityId}`,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    request.on('error', (e) => console.log(`Sensor update failed: ${e.message}`));
    request.write(JSON.stringify(data));
    request.end();
}

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    if (smartConnectState.timer) clearInterval(smartConnectState.timer);
    if (sensorDeliveryState.replayTimer) clearInterval(sensorDeliveryState.replayTimer);
    if (sensorTickTimer) clearTimeout(sensorTickTimer);
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

ipcMain.handle('reset-config', () => {
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
    shell.openExternal(url);
});
