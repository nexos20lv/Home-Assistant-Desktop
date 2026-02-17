const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    saveConfig: (url) => ipcRenderer.invoke('save-config', url),
    launchMain: () => ipcRenderer.send('config-saved'),
    resetConfig: () => ipcRenderer.invoke('reset-config'),
    openPreferences: () => ipcRenderer.send('open-preferences')
});
