const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    saveConfig: (url) => ipcRenderer.invoke('save-config', url),
    saveOnboardingConfig: (config) => ipcRenderer.invoke('save-onboarding-config', config),
    testConnection: (payload) => ipcRenderer.invoke('test-ha-connection', payload),
    launchMain: () => ipcRenderer.send('config-saved'),
    resetConfig: () => ipcRenderer.invoke('reset-config'),
    openPreferences: () => ipcRenderer.send('open-preferences'),
    togglePiP: () => ipcRenderer.send('toggle-pip'),
    toggleWidget: () => ipcRenderer.send('toggle-widget'),
    switchServer: (index) => ipcRenderer.send('switch-server', index),
    onNetworkStatus: (callback) => {
        ipcRenderer.removeAllListeners('network-status');
        ipcRenderer.on('network-status', (_event, status) => callback(status));
    },
    onThemeChanged: (callback) => {
        ipcRenderer.removeAllListeners('shell-theme-changed');
        ipcRenderer.on('shell-theme-changed', (_event, theme) => callback(theme));
    }
});
