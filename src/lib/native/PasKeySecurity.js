import { registerPlugin } from '@capacitor/core';

export const PasKeySecurity = registerPlugin('PasKeySecurity');

export async function getAutofillStatus() {
  try {
    const result = await PasKeySecurity.getAutofillStatus();
    return {
      supported: Boolean(result.supported),
      enabled: Boolean(result.enabled),
    };
  } catch {
    return { supported: false, enabled: false };
  }
}

export async function requestEnableAutofill() {
  return PasKeySecurity.requestEnableAutofill();
}

export async function openChromeAutofillSettings() {
  return PasKeySecurity.openChromeAutofillSettings();
}

export async function getPendingAutofillSaves() {
  const result = await PasKeySecurity.getPendingAutofillSaves();
  return JSON.parse(result.json || '[]');
}

export async function clearPendingAutofillSaves() {
  await PasKeySecurity.clearPendingAutofillSaves();
}

export async function removePendingAutofillSaves(ids) {
  await PasKeySecurity.removePendingAutofillSaves({ json: JSON.stringify(ids) });
}

// The native layer requests Android BiometricPrompt before it releases this
// device-wrapped vault key. Android chooses the enrolled fingerprint or face
// modality; PasKey never receives biometric data.
export async function enableBiometricVaultKey(key) {
  return PasKeySecurity.enableBiometricVaultKey({ key });
}

export async function unlockBiometricVaultKey() {
  const result = await PasKeySecurity.unlockBiometricVaultKey();
  return result.key || '';
}

export async function clearBiometricVaultKey() {
  try { await PasKeySecurity.clearBiometricVaultKey(); } catch { /* browser/no native bridge */ }
}

export async function hasBiometricVaultKey() {
  try {
    const result = await PasKeySecurity.hasBiometricVaultKey();
    return Boolean(result.available);
  } catch {
    return false;
  }
}

export async function clearNativeAutofillVault() {
  try { await PasKeySecurity.clearAutofillVault(); } catch { /* browser/no native bridge */ }
}

export async function readNativeVaultEntity(entity) {
  const result = await PasKeySecurity.readVaultEntity({ entity });
  return JSON.parse(result.json || '[]');
}

export async function writeNativeVaultEntity(entity, rows) {
  await PasKeySecurity.writeVaultEntity({ entity, json: JSON.stringify(rows || []) });
}

export async function clearNativeVaultStorage() {
  try { await PasKeySecurity.clearVaultStorage(); } catch { /* browser/no native bridge */ }
}

export async function setScreenshotProtection(enabled) {
  try {
    const result = await PasKeySecurity.setScreenshotProtection({ enabled: Boolean(enabled) });
    return Boolean(result.enabled);
  } catch {
    return false;
  }
}
