const KEY = 'paskey.settings';

export const DEFAULT_SETTINGS = {
  autoLockMinutes: 5,
  biometricUnlock: false, // requires native BiometricPrompt
  clipboardClearSeconds: 30,
  screenshotProtection: true, // requires native FLAG_SECURE
  requireAuthToReveal: true,
  theme: 'dark',
};

export function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s) {
  localStorage.setItem(KEY, JSON.stringify(s));
}