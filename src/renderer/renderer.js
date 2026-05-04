const steps = ['local', 'remote', 'token'];
let currentStep = 0;

const localUrlInput = document.getElementById('local-url-input');
const remoteUrlInput = document.getElementById('remote-url-input');
const tokenInput = document.getElementById('token-input');

const testBtn = document.getElementById('test-btn');
const backBtn = document.getElementById('back-btn');
const nextBtn = document.getElementById('next-btn');
const finishBtn = document.getElementById('finish-btn');

const statusBox = document.getElementById('status-box');
const autoFixHint = document.getElementById('autofix-hint');

// Initialize i18n
async function initializeI18n() {
    const response = await fetch('../locales/translations.json');
    const translations = await response.json();
    await i18n.loadTranslations(translations);
    updateUIText();
}

function updateUIText() {
    document.title = i18n.t('setup.title');
    
    // Update h1 and subtitle
    document.querySelector('h1').textContent = i18n.t('setup.title');
    document.querySelector('.subtitle').textContent = i18n.t('setup.subtitle');
    
    // Update button texts
    testBtn.textContent = i18n.t('setup.test');
    backBtn.textContent = i18n.t('setup.back');
    nextBtn.textContent = i18n.t('setup.continue');
    finishBtn.textContent = i18n.t('setup.finish');
    
    // Update input placeholders
    localUrlInput.placeholder = 'homeassistant.local:8123';
    remoteUrlInput.placeholder = 'xyz.ui.nabu.casa';
    tokenInput.placeholder = 'Long-lived access token';
    
    // Update panel titles and helps
    document.getElementById('title-local').textContent = i18n.t('setup.localUrl');
    document.getElementById('help-local').textContent = i18n.t('setup.localUrlHelp');
    
    document.getElementById('title-remote').textContent = i18n.t('setup.remoteUrl');
    document.getElementById('help-remote').textContent = i18n.t('setup.remoteUrlHelp');
    
    document.getElementById('title-token').textContent = i18n.t('setup.token');
    document.getElementById('help-token').textContent = i18n.t('setup.tokenHelp');
    
    // Update language label
    document.getElementById('language-label').textContent = i18n.t('preferences.language') + ':';
}

// Initialize language selector
function initLanguageSelector() {
    const langSelect = document.getElementById('setup-language-select');
    const currentLang = i18n.getCurrentLanguage();
    langSelect.value = currentLang;
    
    langSelect.addEventListener('change', (e) => {
        i18n.setLanguage(e.target.value);
        updateUIText();
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeI18n();
    initLanguageSelector();
});
window.addEventListener('i18n-language-changed', updateUIText);

function normalizeUrl(url) {
    const trimmed = (url || '').trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `http://${trimmed}`;
}

function updateStepUi() {
    document.querySelectorAll('.step-panel').forEach((panel, index) => {
        panel.classList.toggle('active', index === currentStep);
    });

    document.querySelectorAll('.step-dot').forEach((dot, index) => {
        dot.classList.toggle('done', index < currentStep);
        dot.classList.toggle('active', index === currentStep);
    });

    backBtn.disabled = currentStep === 0;
    nextBtn.classList.toggle('hidden', currentStep === steps.length - 1);
    finishBtn.classList.toggle('hidden', currentStep !== steps.length - 1);
    autoFixHint.classList.add('hidden');
    clearStatus();
}

function setStatus(kind, message) {
    statusBox.className = `status ${kind}`;
    statusBox.textContent = message;
    statusBox.classList.remove('hidden');
}

function clearStatus() {
    statusBox.classList.add('hidden');
    statusBox.textContent = '';
}

function maybeAutoFix(urlInputEl) {
    const rawValue = urlInputEl.value.trim();
    if (!rawValue) return '';

    if (!/^https?:\/\//i.test(rawValue)) {
        const fixed = normalizeUrl(rawValue);
        urlInputEl.value = fixed;
        const msg = i18n.t('setup.autoFixUrl').replace('{url}', fixed);
        autoFixHint.textContent = msg;
        autoFixHint.classList.remove('hidden');
        return fixed;
    }

    autoFixHint.classList.add('hidden');
    return rawValue;
}

async function testCurrentStepConnection() {
    const isLocalStep = currentStep === 0;
    const isRemoteStep = currentStep === 1;
    if (!isLocalStep && !isRemoteStep) {
        setStatus('info', i18n.t('setup.noTestRequired'));
        return true;
    }

    const input = isLocalStep ? localUrlInput : remoteUrlInput;
    let url = maybeAutoFix(input);
    if (!url) {
        setStatus('error', i18n.t('setup.enterUrlBeforeTest'));
        return false;
    }

    testBtn.disabled = true;
    setStatus('info', i18n.t('setup.testingConnection'));

    try {
        const result = await window.electronAPI.testConnection({
            url,
            token: tokenInput.value.trim()
        });

        if (result.ok) {
            const target = isLocalStep ? i18n.t('setup.localConnection') : i18n.t('setup.remoteConnection');
            const authText = result.authRequired ? i18n.t('setup.authRequired') : i18n.t('setup.authNotRequired');
            const msg = i18n.t('setup.connectionValid').replace('{target}', target).replace('{auth}', authText);
            setStatus('success', msg);
            return true;
        }

        setStatus('error', result.message || i18n.t('setup.connectionFailed'));
        return false;
    } catch (_error) {
        setStatus('error', i18n.t('setup.testConnectionError'));
        return false;
    } finally {
        testBtn.disabled = false;
    }
}

function validateCurrentStep() {
    if (currentStep === 0) {
        const url = maybeAutoFix(localUrlInput);
        if (!url) {
            setStatus('error', i18n.t('setup.localUrlRequired'));
            return false;
        }
    }

    if (currentStep === 1) {
        if (!remoteUrlInput.value.trim()) {
            setStatus('info', i18n.t('setup.remoteUrlOptional'));
            return true;
        }
        maybeAutoFix(remoteUrlInput);
    }

    return true;
}

async function finishOnboarding() {
    finishBtn.disabled = true;
    setStatus('info', i18n.t('setup.savingConfig'));

    const payload = {
        localUrl: normalizeUrl(localUrlInput.value),
        remoteUrl: normalizeUrl(remoteUrlInput.value),
        token: tokenInput.value.trim()
    };

    try {
        await window.electronAPI.saveOnboardingConfig(payload);
        window.electronAPI.launchMain();
    } catch (_err) {
        setStatus('error', i18n.t('setup.savingConfigError'));
        finishBtn.disabled = false;
    }
}

testBtn.addEventListener('click', async () => {
    await testCurrentStepConnection();
});

backBtn.addEventListener('click', () => {
    if (currentStep > 0) {
        currentStep -= 1;
        updateStepUi();
    }
});

nextBtn.addEventListener('click', async () => {
    if (!validateCurrentStep()) return;

    if (currentStep === 0 || (currentStep === 1 && remoteUrlInput.value.trim())) {
        const ok = await testCurrentStepConnection();
        if (!ok) return;
    }

    if (currentStep < steps.length - 1) {
        currentStep += 1;
        updateStepUi();
    }
});

finishBtn.addEventListener('click', async () => {
    if (!validateCurrentStep()) return;
    await finishOnboarding();
});

updateStepUi();
