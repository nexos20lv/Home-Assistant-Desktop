const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('prefsAPI', {
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    getErrorLogs: () => ipcRenderer.invoke('get-error-logs'),
    exportErrorLogs: () => ipcRenderer.invoke('export-error-logs'),
    openExternal: (url) => ipcRenderer.send('open-external', url)
});
