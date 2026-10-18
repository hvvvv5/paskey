const KEY = 'paskey.settings';

export const DEFAULT_SETTINGS = {
  autoLockMinutes: 5,
  biometricUnlock: false, // requires native BiometricPrompt
  clipboardClearSeconds: 30,
  screenshotProtection: true, // requires native FLAG_SECURE
  requireAuthToReveal: true,
  theme: 'dark',
  language: 'en',
};

export const THEME_OPTIONS = ['system', 'dark', 'cream', 'pro'];

export function loadSettings() {
  try {
    const loaded = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    if (loaded.theme === 'light') loaded.theme = 'cream';
    if (!THEME_OPTIONS.includes(loaded.theme)) loaded.theme = DEFAULT_SETTINGS.theme;
    return loaded;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
