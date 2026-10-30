const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('widgetAPI', {
    close: () => ipcRenderer.send('toggle-widget'),
    openMainWindow: () => ipcRenderer.send('open-main-window'),
    triggerAction: (type) => ipcRenderer.send('trigger-widget-action', { type: String(type) })
});
