const form = document.getElementById('setup-form');
const urlInput = document.getElementById('url-input');
const connectBtn = document.getElementById('connect-btn');
const errorMsg = document.getElementById('error-msg');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = urlInput.value.trim();

    if (!url) {
        showError('Please enter a URL');
        return;
    }

    setLoading(true);

    try {
        // Basic connectivity check before saving?
        // For now, we trust the user or let the main window fail to load.
        // We could fetch looking for a 200 or 401, but CORS might block it here.
        // Let's just save and try to launch.

        await window.electronAPI.saveConfig(url);
        window.electronAPI.launchMain();

    } catch (err) {
        showError('Failed to save configuration.');
        setLoading(false);
    }
});

function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
    setTimeout(() => {
        errorMsg.classList.add('hidden');
    }, 3000);
}

function setLoading(isLoading) {
    if (isLoading) {
        connectBtn.disabled = true;
        connectBtn.querySelector('span').textContent = 'Connecting...';
    } else {
        connectBtn.disabled = false;
        connectBtn.querySelector('span').textContent = 'Connect';
    }
}
