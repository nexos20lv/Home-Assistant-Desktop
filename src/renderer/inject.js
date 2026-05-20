// Inject a disconnect button
console.log('Home Assistant Desktop: Injection script loaded');

const updateButtonVisibility = () => {
    const currentUrl = window.location.href;
    const isSettingsPage = currentUrl.includes('/config') ||
        currentUrl.includes('/profile') ||
        currentUrl.includes('/_my_redirect/'); // Common HA redirect pattern

    let btn = document.getElementById('ha-desktop-disconnect-btn');

    if (isSettingsPage) {
        if (!btn) {
            createButton();
        } else {
            btn.style.display = 'flex';
        }
    } else {
        if (btn) {
            btn.style.display = 'none';
        }
    }
};

const createButton = () => {
    console.log('Home Assistant Desktop: Creating button...');
    const btn = document.createElement('button');
    btn.id = 'ha-desktop-disconnect-btn';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.style.cssText = 'width:24px;height:24px';
    const svgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svgPath.setAttribute('fill', 'currentColor');
    svgPath.setAttribute('d', 'M17,7L15.59,8.41L18.17,11H8V13H18.17L15.59,15.58L17,17L22,12L17,7M4,5H12V3H4A2,2 0 0,0 2,5V19A2,2 0 0,0 4,21H12V19H4V5Z');
    svg.appendChild(svgPath);

    const label = document.createElement('span');
    label.style.marginLeft = '8px';
    label.textContent = (window.i18n && window.i18n.t('shell.disconnectButton')) || 'Disconnect App';

    btn.appendChild(svg);
    btn.appendChild(label);

    // Explicit styles
    btn.style.position = 'fixed';
    btn.style.bottom = '20px';
    btn.style.right = '20px';
    btn.style.zIndex = '999999';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.padding = '12px 20px';
    btn.style.background = 'rgba(15, 23, 42, 0.95)';
    btn.style.color = 'white';
    btn.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    btn.style.borderRadius = '50px';
    btn.style.cursor = 'pointer';
    btn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';

    btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(56, 189, 248, 0.9)';
        btn.style.transform = 'translateY(-2px) scale(1.05)';
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.background = 'rgba(15, 23, 42, 0.95)';
        btn.style.transform = 'translateY(0) scale(1)';
    });

    btn.addEventListener('click', () => {
        if (window.electronAPI) {
            window.electronAPI.resetConfig();
        } else {
            alert('Error: Electron API not found. Please restart the app.');
        }
    });

    document.body.appendChild(btn);
};

const createTitleBar = () => {
    if (document.getElementById('ha-desktop-titlebar')) return;

    const bar = document.createElement('div');
    bar.id = 'ha-desktop-titlebar';
    const barLabel = document.createElement('span');
    barLabel.textContent = 'Home Assistant Desktop';
    bar.appendChild(barLabel);
    document.body.prepend(bar);
};

// Initial check
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        createTitleBar();
        updateButtonVisibility();
    });
} else {
    createTitleBar();
    updateButtonVisibility();
}

// React to SPA navigation without polling
const _onNavigate = () => {
    createTitleBar();
    updateButtonVisibility();
};

window.addEventListener('popstate', _onNavigate);

const _origPush = history.pushState.bind(history);
history.pushState = (...args) => { _origPush(...args); _onNavigate(); };

const _origReplace = history.replaceState.bind(history);
history.replaceState = (...args) => { _origReplace(...args); _onNavigate(); };
