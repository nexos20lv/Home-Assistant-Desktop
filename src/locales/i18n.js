/**
 * Simple i18n (internationalization) module
 * Handles language detection, switching, and translation lookup
 */

class I18n {
    constructor() {
        this.currentLanguage = this.detectLanguage();
        this.translations = {};
        this.fallbackLanguage = 'en';
    }

    /**
     * Detect system language or get saved preference
     */
    detectLanguage() {
        // Check for saved preference
        const savedLang = localStorage.getItem('app-language');
        if (savedLang) return savedLang;

        // Get browser/system language
        const browserLang = navigator.language?.split('-')[0] || navigator.userLanguage?.split('-')[0];
        
        // Map browser language to supported language
        const supportedLanguages = ['en', 'fr', 'es', 'de', 'it', 'pt', 'nl'];
        return supportedLanguages.includes(browserLang) ? browserLang : 'en';
    }

    /**
     * Load translations from JSON
     */
    async loadTranslations(translationsObj) {
        this.translations = translationsObj;
    }

    /**
     * Set language and save preference
     */
    setLanguage(lang) {
        if (this.translations[lang]) {
            this.currentLanguage = lang;
            localStorage.setItem('app-language', lang);
            // Trigger language change event for UI updates
            window.dispatchEvent(new CustomEvent('i18n-language-changed', { detail: { language: lang } }));
            return true;
        }
        return false;
    }

    /**
     * Get translation key
     * Supports nested keys with dot notation (e.g., "setup.title")
     */
    t(key, defaultValue = '') {
        const keys = key.split('.');
        let value = this.translations[this.currentLanguage] || {};

        for (const k of keys) {
            value = value[k];
            if (value === undefined) {
                // Try fallback language
                value = this.translations[this.fallbackLanguage] || {};
                for (const fallbackK of keys) {
                    value = value[fallbackK];
                    if (value === undefined) return defaultValue || key;
                }
                return value;
            }
        }

        return value || defaultValue || key;
    }

    /**
     * Pluralization support
     */
    tp(key, count) {
        const singular = this.t(`${key}.singular`);
        const plural = this.t(`${key}.plural`);
        return count === 1 ? singular : plural;
    }

    /**
     * Get list of available languages
     */
    getAvailableLanguages() {
        return Object.keys(this.translations || {});
    }

    /**
     * Get current language
     */
    getCurrentLanguage() {
        return this.currentLanguage;
    }
}

// Create global instance
const i18n = new I18n();

// Make available globally
if (typeof window !== 'undefined') {
    window.i18n = i18n;
}

// For Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { I18n, i18n };
}
