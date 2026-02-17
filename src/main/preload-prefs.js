const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('prefsAPI', {
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings)
});
