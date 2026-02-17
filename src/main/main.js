const { app, BrowserWindow, BrowserView, ipcMain, shell, Tray, Menu, globalShortcut, powerMonitor } = require('electron');
const path = require('path');
const Store = require('electron-store');
const fs = require('fs');
const os = require('os');
const https = require('http'); // Using http for local IP, could be https if SSL needed

const store = new Store();

let mainWindow;
let view;
let tray;
let isQuiting = false;
// Handle Squirrel Startup (to avoid multiple instances)
if (require('electron-squirrel-startup')) {
    app.quit();
}

// Initialize Auto Updater
const { updateElectronApp } = require('update-electron-app');
updateElectronApp({
    repo: 'nexos20lv/Home-Assistant-Desktop',
    updateInterval: '1 hour'
});

function createMainWindow() {
    const haUrl = store.get('haUrl');

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
            height: 32 // Match shell.css titlebar height
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
            contextIsolation: true
        }
    });

    mainWindow.setBrowserView(view);

    // Initial bounds setting
    updateViewBounds();

    // Load HA URL into the view
    view.webContents.loadURL(haUrl);

    // Handle Resize
    mainWindow.on('resize', updateViewBounds);
    mainWindow.on('maximize', updateViewBounds);
    mainWindow.on('unmaximize', updateViewBounds);
    mainWindow.on('enter-full-screen', updateViewBounds);
    mainWindow.on('leave-full-screen', updateViewBounds);

    let isQuiting = false;

    mainWindow.on('close', function (event) {
        if (!isQuiting) {
            event.preventDefault();
            mainWindow.hide();
        }
        return false;
    });

    // Handle external links in default browser (for the View)
    view.webContents.setWindowOpenHandler(({ url }) => {
        // Security: Only allow http and https protocols
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
    const titleBarHeight = 32;

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

app.whenReady().then(() => {
    createMainWindow();

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
    app.setUserTasks([
        {
            program: process.execPath,
            arguments: '--force-reload',
            iconPath: process.execPath,
            iconIndex: 0,
            title: 'Reload',
            description: 'Reload the application'
        }
    ]);

    // System Tray Implementation
    const { nativeImage } = require('electron');
    const iconPath = path.join(__dirname, '../assets/logo.png'); // Use PNG
    console.log('Loading Tray Icon from:', iconPath);

    try {
        const trayIcon = nativeImage.createFromPath(iconPath);
        tray = new Tray(trayIcon);

        const contextMenu = Menu.buildFromTemplate([
            { label: 'Show App', click: () => mainWindow && mainWindow.show() },
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

ipcMain.handle('get-settings', () => {
    return {
        autoLaunch: store.get('autoLaunch', false),
        globalShortcut: store.get('globalShortcut', false),
        apiToken: store.get('apiToken', ''),
        appVersion: app.getVersion() // Send current version
    };
});

ipcMain.handle('save-settings', (event, settings) => {
    store.set('autoLaunch', settings.autoLaunch);
    store.set('globalShortcut', settings.globalShortcut);
    store.set('apiToken', settings.apiToken);

    // 1. Auto Launch
    app.setLoginItemSettings({
        openAtLogin: settings.autoLaunch,
        path: app.getPath('exe')
    });

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
    startSensorReporting();

    return true;
});

let sensorInterval;
function startSensorReporting() {
    if (sensorInterval) clearInterval(sensorInterval);

    const token = store.get('apiToken');
    const haUrl = store.get('haUrl');

    if (!token || !haUrl) return;

    const cpuInterval = setInterval(async () => {
        // CPU Usage (Simple Load Average for now as os.cpus() is snapshot)
        // For better CPU data, we'd need 'systeminformation' library but using os loads for simplicity/no-deps
        const cpus = os.cpus();

        // Memory Usage
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memPercent = Math.round((usedMem / totalMem) * 100);

        reportSensor(haUrl, token, 'sensor.desktop_memory_usage', {
            state: memPercent,
            attributes: {
                friendly_name: `${os.hostname()} Memory Usage`,
                unit_of_measurement: '%',
                icon: 'mdi:memory',
                total_memory_gb: (totalMem / (1024 ** 3)).toFixed(2),
                free_memory_gb: (freeMem / (1024 ** 3)).toFixed(2)
            }
        });

        reportSensor(haUrl, token, 'sensor.desktop_status', {
            state: 'Active',
            attributes: {
                friendly_name: `${os.hostname()} Status`,
                hostname: os.hostname(),
                platform: os.platform(),
                arch: os.arch(),
                uptime_hours: (os.uptime() / 3600).toFixed(2),
                icon: 'mdi:desktop-tower'
            }
        });
    }, 60000);

    // Store interval to clear later
    sensorInterval = cpuInterval;
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

function createPreferencesWindow() {
    const prefWindow = new BrowserWindow({
        width: 400,
        height: 520,
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

ipcMain.handle('reset-config', () => {
    store.delete('haUrl');
    app.relaunch();
    app.exit(0);
});



ipcMain.on('open-preferences', () => {
    createPreferencesWindow();
});
