const { ipcRenderer } = require('electron');

document.getElementById('close-widget-btn').addEventListener('click', () => {
    ipcRenderer.send('toggle-widget');
});

document.getElementById('tile-open-app').addEventListener('click', () => {
    ipcRenderer.send('open-main-window');
});

document.getElementById('tile-lights').addEventListener('click', () => {
    ipcRenderer.send('trigger-widget-action', { type: 'lights' });
    const status = document.getElementById('lights-status');
    status.textContent = status.textContent === 'On' ? 'Off' : 'On';
});

document.getElementById('tile-lock').addEventListener('click', () => {
    ipcRenderer.send('trigger-widget-action', { type: 'lock' });
});

document.getElementById('tile-climate').addEventListener('click', () => {
    ipcRenderer.send('trigger-widget-action', { type: 'climate' });
});

document.getElementById('tile-media').addEventListener('click', () => {
    ipcRenderer.send('trigger-widget-action', { type: 'media' });
});

document.getElementById('tile-scene').addEventListener('click', () => {
    ipcRenderer.send('trigger-widget-action', { type: 'scene' });
});
