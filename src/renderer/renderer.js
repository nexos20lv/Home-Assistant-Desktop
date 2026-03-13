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
        autoFixHint.textContent = `URL corrigée automatiquement: ${fixed}`;
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
        setStatus('info', 'Aucun test réseau requis pour cette étape.');
        return true;
    }

    const input = isLocalStep ? localUrlInput : remoteUrlInput;
    let url = maybeAutoFix(input);
    if (!url) {
        setStatus('error', 'Merci de saisir une URL avant de tester.');
        return false;
    }

    testBtn.disabled = true;
    setStatus('info', 'Test de connexion en cours...');

    try {
        const result = await window.electronAPI.testConnection({
            url,
            token: tokenInput.value.trim()
        });

        if (result.ok) {
            const target = isLocalStep ? 'locale' : 'distante';
            const authText = result.authRequired ? 'auth requise' : 'auth non requise';
            setStatus('success', `Connexion ${target} valide (${authText}).`);
            return true;
        }

        setStatus('error', result.message || 'Connexion impossible.');
        return false;
    } catch (_error) {
        setStatus('error', 'Impossible de tester la connexion pour le moment.');
        return false;
    } finally {
        testBtn.disabled = false;
    }
}

function validateCurrentStep() {
    if (currentStep === 0) {
        const url = maybeAutoFix(localUrlInput);
        if (!url) {
            setStatus('error', 'L URL locale est obligatoire.');
            return false;
        }
    }

    if (currentStep === 1) {
        if (!remoteUrlInput.value.trim()) {
            setStatus('info', 'Étape facultative ignorée: aucune URL distante renseignée.');
            return true;
        }
        maybeAutoFix(remoteUrlInput);
    }

    return true;
}

async function finishOnboarding() {
    finishBtn.disabled = true;
    setStatus('info', 'Enregistrement de la configuration...');

    const payload = {
        localUrl: normalizeUrl(localUrlInput.value),
        remoteUrl: normalizeUrl(remoteUrlInput.value),
        token: tokenInput.value.trim()
    };

    try {
        await window.electronAPI.saveOnboardingConfig(payload);
        window.electronAPI.launchMain();
    } catch (_err) {
        setStatus('error', 'Impossible de sauvegarder la configuration.');
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
