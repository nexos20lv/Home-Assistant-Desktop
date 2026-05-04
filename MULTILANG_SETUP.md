# Multi-Language System Documentation

## Overview

The Home Assistant Desktop application now includes a complete multi-language (i18n) system with:
- **Auto-detection** of system language on first launch
- **Manual language selection** in preferences
- **7 languages supported**: English, French, Spanish, German, Italian, Portuguese, Dutch
- **Persistent language preference** saved in localStorage

## Architecture

### Files Structure
```
src/locales/
├── i18n.js              # i18n module (language manager)
└── translations.json    # Translation strings for all languages
```

### Key Components

#### 1. **i18n.js** - The i18n Module
A lightweight internationalization module that:
- Detects system language automatically
- Loads translations from JSON
- Provides `i18n.t()` method to get translated strings
- Manages language switching
- Saves language preference to localStorage

**Key Methods:**
```javascript
i18n.t(key)                  // Get translation (supports nested keys)
i18n.setLanguage(lang)       // Switch language
i18n.getCurrentLanguage()    // Get active language
i18n.getAvailableLanguages() // List all languages
```

#### 2. **translations.json** - Translation Strings
Contains all UI strings organized by language and feature:
```json
{
  "en": {
    "setup": { "title": "Connection Setup", ... },
    "shell": { "offline": "Offline", ... },
    "preferences": { "language": "Language", ... }
  },
  "fr": { ... },
  "es": { ... },
  ...
}
```

## Implementation in Files

### Setup Page (index.html)
- Loads `i18n.js` before `renderer.js`
- Calls `initializeI18n()` to load translations
- Uses `i18n.t()` to display localized text

### Shell (shell.html)
- Updates button titles with `i18n.t()`
- Listens to `i18n-language-changed` event
- Network status messages (Local/Remote/Offline) are translated

### Preferences (preferences.html)
- Language selector dropdown with all 7 languages
- Changing language reloads the page to apply translations
- Saves preference automatically

### Renderer (renderer.js)
- Uses `i18n.t()` for all error messages and status text
- Supports template placeholders: `{url}`, `{target}`, `{auth}`

## Usage Examples

### In JavaScript
```javascript
// Get a translation
const message = i18n.t('setup.testingConnection');

// With placeholder
const msg = i18n.t('setup.connectionValid')
    .replace('{target}', 'local')
    .replace('{auth}', 'auth required');

// Check current language
if (i18n.getCurrentLanguage() === 'fr') {
    // French-specific logic
}
```

### In HTML
```html
<span data-i18n="preferences.language">Language</span>
```

### Adding New Strings
1. Edit `src/locales/translations.json`
2. Add key under each language:
```json
"en": {
    "feature": {
        "newString": "New text in English"
    }
},
"fr": {
    "feature": {
        "newString": "Nouveau texte en français"
    }
}
```
3. Use in code: `i18n.t('feature.newString')`

## Language Auto-Detection

When the app launches for the first time:
1. Browser language is detected from `navigator.language`
2. Mapped to supported languages: en, fr, es, de, it, pt, nl
3. Falls back to English if not supported
4. User can override in Preferences

## Events

The i18n system emits events when language changes:
```javascript
window.addEventListener('i18n-language-changed', (event) => {
    const newLanguage = event.detail.language;
    // Update UI accordingly
});
```

## Adding New Languages

To add a new language (e.g., Japanese):
1. Add language code to supported list in `i18n.js`:
```javascript
const supportedLanguages = ['en', 'fr', 'es', 'de', 'it', 'pt', 'nl', 'ja'];
```

2. Add translations to `translations.json`:
```json
"ja": {
    "setup": { ... },
    "shell": { ... },
    "preferences": { ... }
}
```

3. Add language option to preferences dropdown:
```html
<option value="ja">日本語</option>
```

## Supported Languages

| Code | Language | Status |
|------|----------|--------|
| en | English | ✅ Complete |
| fr | Français | ✅ Complete |
| es | Español | ✅ Complete |
| de | Deutsch | ✅ Complete |
| it | Italiano | ✅ Complete |
| pt | Português | ✅ Complete |
| nl | Nederlands | ✅ Complete |

## Best Practices

1. **Always use i18n.t()** for user-facing text
2. **Keep translation keys organized** by feature/page
3. **Use descriptive key names** (e.g., `setup.connectionValid` not `msg1`)
4. **Test all languages** when adding new features
5. **Support template placeholders** for dynamic content
6. **Reload page after language change** for consistency

## Troubleshooting

### Translations not showing
- Check if i18n.js is loaded before other scripts
- Verify translation key exists in translations.json
- Check browser console for errors

### Language not persisting
- Clear localStorage if needed
- Check browser console for localStorage errors
- Verify localStorage is enabled

### Missing translations fallback
- Falls back to English if key not found
- Check console for missing key warnings
- Add missing key to all language objects

## Future Enhancements

- [ ] RTL language support (Arabic, Hebrew)
- [ ] Language selector in onboarding
- [ ] Pluralization support
- [ ] Date/time localization
- [ ] Number/currency formatting
- [ ] Translation management UI
