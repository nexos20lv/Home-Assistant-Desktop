const { app, BrowserWindow, BrowserView, ipcMain, shell, Tray, Menu, globalShortcut, nativeTheme, powerMonitor } = require('electron');
const path = require('path');
const Store = require('electron-store');
const fs = require('fs');
const os = require('os');
const https = require('http'); // Using http for local IP, could be https if SSL needed
const { exec } = require('child_process');
const { machineIdSync } = require('node-machine-id');
const util = require('util');
const execPromise = util.promisify(exec);

const store = new Store();

let mainWindow;
let view;
let tray;
let isQuiting = false;
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

function createMainWindow() {
    const haUrl = getEffectiveUrl();

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

    view.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        const haUrl = store.get('haUrl');
        const remoteUrl = store.get('remoteUrl');
        
        // If we failed on the local URL and have a remote URL, try that
        if (validatedURL.includes(haUrl) && remoteUrl && haUrl !== remoteUrl) {
            console.log('Local URL failed, trying remote URL...');
            view.webContents.loadURL(remoteUrl);
        }
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
    const sendMediaService = (service) => {
        const haUrl = getEffectiveUrl();
        const apiToken = store.get('apiToken');
        const entityId = store.get('mediaPlayerEntity', 'media_player.all'); // Fallback or user-defined

        if (!haUrl || !apiToken) return;

        axios.post(`${haUrl}/api/services/media_player/${service}`, 
            { entity_id: entityId },
            { headers: { Authorization: `Bearer ${apiToken}` } }
        ).catch(err => console.error(`Media Key Error (${service}):`, err.message));
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
    session.fromPartition('persist:homeassistant').setPermissionRequestHandler((webContents, permission, callback) => {
        const allowedPermissions = ['notifications', 'media', 'audioCapture', 'videoCapture'];
        if (allowedPermissions.includes(permission)) {
            callback(true);
        } else {
            callback(false);
        }
    });

    // Load HA URL into the view
    view.webContents.loadURL(haUrl);

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

const runStartupScripts = () => {
    const scripts = store.get('startupScripts', '');
    if (scripts) {
        scripts.split('\n').forEach(line => {
            const cmd = line.trim();
            if (cmd) exec(cmd).unref();
        });
    }
};

app.whenReady().then(async () => {
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

ipcMain.handle('get-settings', () => {
    return {
        autoLaunch: store.get('autoLaunch', false),
        globalShortcut: store.get('globalShortcut', false),
        autoUpdates: store.get('autoUpdates', true),
        mediaPlayerEntity: store.get('mediaPlayerEntity', 'media_player.all'),
        customCSS: store.get('customCSS', ''),
        biometricLock: store.get('biometricLock', false),
        startupScripts: store.get('startupScripts', ''),
        haUrl: store.get('haUrl' || ''),
        remoteUrl: store.get('remoteUrl' || ''),
        useRemote: store.get('useRemote', false),
        apiToken: store.get('apiToken', ''),
        appVersion: app.getVersion() // Send current version
    };
});

ipcMain.handle('save-settings', (event, settings) => {
    store.set('haUrl', settings.haUrl);
    store.set('remoteUrl', settings.remoteUrl);
    store.set('useRemote', settings.useRemote);
    store.set('autoLaunch', settings.autoLaunch);
    store.set('globalShortcut', settings.globalShortcut);
    store.set('autoUpdates', settings.autoUpdates);
    store.set('mediaPlayerEntity', settings.mediaPlayerEntity);
    store.set('customCSS', settings.customCSS);
    store.set('biometricLock', settings.biometricLock);
    store.set('startupScripts', settings.startupScripts);
    store.set('apiToken', settings.apiToken);
    store.set('reportMedia', settings.reportMedia);
    store.set('reportDnd', settings.reportDnd);

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
    const haUrl = getEffectiveUrl();
    view.webContents.loadURL(`${haUrl}/${path}`);
}

let sensorInterval;
function startSensorReporting() {
    if (sensorInterval) clearInterval(sensorInterval);

    const haUrl = getEffectiveUrl();
    const apiToken = store.get('apiToken');

    if (!haUrl || !apiToken) return;

    let uniqueId = 'unknown_pc';
    try {
        uniqueId = machineIdSync();
    } catch (error) {
        console.error('Failed to get machine Id, generating random:', error);
        const uuidFallback = store.get('uuidFallback');
        if (uuidFallback) {
            uniqueId = uuidFallback;
        } else {
            uniqueId = require('crypto').randomUUID();
            store.set('uuidFallback', uniqueId);
        }
    }

    let previousCpuInfo = getCpuInfo();

    const cpuInterval = setInterval(async () => {
        const currentCpuInfo = getCpuInfo();
        const idleDifference = currentCpuInfo.idle - previousCpuInfo.idle;
        const totalDifference = currentCpuInfo.total - previousCpuInfo.total;

        // Calculate CPU usage percentage
        let cpuPercent = 0;
        if (totalDifference > 0) {
            cpuPercent = Math.round(100 - (100 * idleDifference / totalDifference));
        }
        previousCpuInfo = currentCpuInfo;

        // Memory Usage
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memPercent = Math.round((usedMem / totalMem) * 100);

        const idleState = powerMonitor.getSystemIdleState(300);
        const activeApp = await getActiveApp();

        const safeHostname = os.hostname().toLowerCase().replace(/[^a-z0-9_]/g, '_');

        reportSensor(haUrl, apiToken, `sensor.${safeHostname}_desktop_memory_usage`, {
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

        reportSensor(haUrl, apiToken, `sensor.${safeHostname}_desktop_cpu_usage`, {
            state: cpuPercent,
            attributes: {
                friendly_name: `${os.hostname()} CPU Usage`,
                unit_of_measurement: '%',
                icon: 'mdi:cpu-64-bit',
                unique_id: `${uniqueId}_cpu`
            }
        });

        reportSensor(haUrl, apiToken, `sensor.${safeHostname}_desktop_status`, {
            state: 'Active',
            attributes: {
                friendly_name: `${os.hostname()} Status`,
                hostname: os.hostname(),
                platform: os.platform(),
                arch: os.arch(),
                uptime_hours: (os.uptime() / 3600).toFixed(2),
                is_idle: powerMonitor.getSystemIdleState(300) === 'idle',
                active_app: await getActiveApp(),
                dnd_mode: store.get('reportDnd', true) ? await getDNDStatus() : false,
                icon: 'mdi:desktop-tower',
                unique_id: `${uniqueId}_status`
            }
        });

        // Mic/Cam Sensor
        if (store.get('reportMedia', true)) {
            const mediaStatus = await getMicCameraStatus();
            reportSensor(haUrl, apiToken, `sensor.${safeHostname}_desktop_media_status`, {
                state: mediaStatus.cam || mediaStatus.mic ? 'In Use' : 'Idle',
                attributes: {
                    friendly_name: `${os.hostname()} Media Activity`,
                    camera_active: mediaStatus.cam,
                    microphone_active: mediaStatus.mic,
                    icon: mediaStatus.cam ? 'mdi:camera' : (mediaStatus.mic ? 'mdi:microphone' : 'mdi:camera-off'),
                    unique_id: `${uniqueId}_media`
                }
            });
        }

        // Uptime sensor (standalone)
        reportSensor(haUrl, apiToken, `sensor.${safeHostname}_desktop_uptime`, {
            state: (os.uptime() / 3600).toFixed(2),
            attributes: {
                friendly_name: `${os.hostname()} Uptime`,
                unit_of_measurement: 'h',
                icon: 'mdi:clock-outline',
                unique_id: `${uniqueId}_uptime`
            }
        });

        // Battery sensor (macOS only for now)
        const batteryInfo = await getBatteryInfo();
        if (batteryInfo) {
            reportSensor(haUrl, apiToken, `sensor.${safeHostname}_desktop_battery`, {
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
    }, 60000);

    sensorInterval = cpuInterval;
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

ipcMain.handle('reset-config', () => {
    store.delete('haUrl');
    app.relaunch();
    app.exit(0);
});



ipcMain.on('open-preferences', () => {
    createPreferencesWindow();
});

ipcMain.on('open-external', (event, url) => {
    shell.openExternal(url);
});
