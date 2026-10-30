// window.widgetAPI comes from preload-widget.js; this page has no Node access.
const { widgetAPI } = window;

document.getElementById('close-widget-btn').addEventListener('click', () => {
    widgetAPI.close();
});

document.getElementById('tile-open-app').addEventListener('click', () => {
    widgetAPI.openMainWindow();
});

document.getElementById('tile-lights').addEventListener('click', () => {
    widgetAPI.triggerAction('lights');
    const status = document.getElementById('lights-status');
    status.textContent = status.textContent === 'On' ? 'Off' : 'On';
});

document.getElementById('tile-lock').addEventListener('click', () => {
    widgetAPI.triggerAction('lock');
});

document.getElementById('tile-climate').addEventListener('click', () => {
    widgetAPI.triggerAction('climate');
});

document.getElementById('tile-media').addEventListener('click', () => {
    widgetAPI.triggerAction('media');
});

document.getElementById('tile-scene').addEventListener('click', () => {
    widgetAPI.triggerAction('scene');
});
