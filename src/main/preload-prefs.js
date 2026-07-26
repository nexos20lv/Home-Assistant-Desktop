const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('prefsAPI', {
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    getErrorLogs: () => ipcRenderer.invoke('get-error-logs'),
    exportErrorLogs: () => ipcRenderer.invoke('export-error-logs'),
    openExternal: (url) => ipcRenderer.send('open-external', url),
    getServers: () => ipcRenderer.invoke('get-servers'),
    saveServers: (data) => ipcRenderer.invoke('save-servers', data),
    getAvailableThemes: () => ipcRenderer.invoke('get-available-themes'),
    getUserThemesPath: () => ipcRenderer.invoke('get-user-themes-path')
});
