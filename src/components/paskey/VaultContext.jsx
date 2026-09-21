import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { syncAutofillVault } from '@/lib/native/syncAutofillVault';
import {
  enableBiometricVaultKey,
  unlockBiometricVaultKey,
  clearBiometricVaultKey,
  hasBiometricVaultKey,
  setScreenshotProtection,
} from '@/lib/native/PasKeySecurity';
import {
  deriveKey,
  encryptText,
  decryptText,
  randomSalt,
  ITERATIONS,
  VERIFY_TOKEN,
  generateDataKey,
  wrapKey,
  unwrapKey,
  exportRaw as exportDataKey,
  importRaw as importDataKey,
} from '@/lib/crypto';
import { loadSettings, saveSettings } from '@/lib/settings';
import { createVaultRepository } from '@/lib/repository/vaultRepository';

const CFG = 'paskey.vault.config';
const VaultContext = createContext(null);
export const useVault = () => useContext(VaultContext);

const readCfg = () => {
  try { return JSON.parse(localStorage.getItem(CFG) || 'null'); } catch { return null; }
};
const writeCfg = (config) => localStorage.setItem(CFG, JSON.stringify(config));
const isAndroid = () => Capacitor.getPlatform() === 'android';

export function VaultProvider({ children }) {
  const [config, setConfig] = useState(readCfg);
  const [settings, setSettings] = useState(loadSettings);
  const [key, setKey] = useState(null);
  const keyRef = useRef(null);
  const timer = useRef(null);
  const backgroundAt = useRef(null);
  const biometricPromptActive = useRef(false);
  const unlockMethodRef = useRef(null);

  const lock = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    keyRef.current = null;
    unlockMethodRef.current = null;
    setKey(null);
  }, []);

  const touch = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const minutes = settings.autoLockMinutes;
    if (!keyRef.current || minutes === -1 || minutes === 0) return;
    timer.current = setTimeout(lock, minutes * 60 * 1000);
  }, [settings.autoLockMinutes, lock]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (biometricPromptActive.current) return;
      if (document.visibilityState === 'hidden' && settings.autoLockMinutes === 0) lock();
    };
    const events = ['pointerdown', 'keydown'];
    events.forEach((event) => window.addEventListener(event, touch));
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      events.forEach((event) => window.removeEventListener(event, touch));
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [touch, lock, settings.autoLockMinutes]);

  useEffect(() => {
    let listener;
    let disposed = false;
    (async () => {
      try {
        listener = await App.addListener('appStateChange', ({ isActive }) => {
          if (biometricPromptActive.current) {
            backgroundAt.current = null;
            return;
          }
          const minutes = settings.autoLockMinutes;
          if (!isActive) {
            backgroundAt.current = Date.now();
            if (minutes === 0) lock();
            return;
          }
          if (backgroundAt.current && minutes > 0 && minutes !== -1) {
            if (Date.now() - backgroundAt.current >= minutes * 60 * 1000) lock();
          }
          backgroundAt.current = null;
        });
        if (disposed) listener.remove();
      } catch {
        // Browser builds can run without the native App bridge.
      }
    })();
    return () => {
      disposed = true;
      if (listener) listener.remove();
    };
  }, [lock, settings.autoLockMinutes]);

  const persist = useCallback((nextConfig, nextKey) => {
    writeCfg(nextConfig);
    setConfig(nextConfig);
    if (nextKey !== undefined) {
      keyRef.current = nextKey;
      setKey(nextKey);
    }
  }, []);

  const updateSettings = useCallback((patch) => {
    setSettings((previous) => {
      const next = { ...previous, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isAndroid()) return;
    setScreenshotProtection(settings.screenshotProtection !== false).catch(() => {});
  }, [settings.screenshotProtection]);

  useEffect(() => {
    const selected = settings.theme || 'dark';
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      document.documentElement.dataset.pkTheme = selected === 'system'
        ? (media.matches ? 'dark' : 'cream')
        : selected;
    };
    applyTheme();
    if (selected !== 'system') return undefined;
    media.addEventListener?.('change', applyTheme);
    return () => media.removeEventListener?.('change', applyTheme);
  }, [settings.theme]);

  // Older PasKey builds only stored a preference flag. Do not display a
  // biometric button after an upgrade unless a native encrypted key wrapper
  // really exists; the user can enable it once from Settings.
  useEffect(() => {
    if (!settings.biometricUnlock || !isAndroid()) return;
    let active = true;
    hasBiometricVaultKey().then((available) => {
      if (active && !available) updateSettings({ biometricUnlock: false });
    });
    return () => { active = false; };
  }, [settings.biometricUnlock, updateSettings]);

  const setup = useCallback(async (password) => {
    const dataKey = await generateDataKey();
    const kekSalt = randomSalt();
    const kek = await deriveKey(password, kekSalt, ITERATIONS);
    const wMaster = await wrapKey(dataKey, kek);
    const verifier = await encryptText(dataKey, VERIFY_TOKEN);
    const next = {
      version: 2,
      kekSalt,
      iterations: ITERATIONS,
      kdf: 'PBKDF2-HMAC-SHA256',
      wMaster,
      verifier,
      createdAt: new Date().toISOString(),
    };
    persist(next, dataKey);
    unlockMethodRef.current = 'master';
    touch();
  }, [persist, touch]);

  const unlock = useCallback(async (password) => {
    const storedConfig = readCfg();
    if (!storedConfig) return false;
    try {
      if (storedConfig.version === 2) {
        const kek = await deriveKey(password, storedConfig.kekSalt, storedConfig.iterations);
        const dataKey = await unwrapKey(storedConfig.wMaster, kek);
        if ((await decryptText(dataKey, storedConfig.verifier)) !== VERIFY_TOKEN) return false;
        persist(storedConfig, dataKey);
        unlockMethodRef.current = 'master';
        touch();
        return true;
      }
      // Old vaults remain master-password unlockable. A fresh wrapped data key
      // config is created without rewriting any encrypted record.
      if (storedConfig.salt) {
        const oldKey = await deriveKey(password, storedConfig.salt, storedConfig.iterations);
        if ((await decryptText(oldKey, storedConfig.verifier)) !== VERIFY_TOKEN) return false;
        const kekSalt = randomSalt();
        const kek = await deriveKey(password, kekSalt, storedConfig.iterations || ITERATIONS);
        const wMaster = await wrapKey(oldKey, kek);
        const verifier = await encryptText(oldKey, VERIFY_TOKEN);
        const next = {
          version: 2,
          kekSalt,
          iterations: storedConfig.iterations || ITERATIONS,
          kdf: 'PBKDF2-HMAC-SHA256',
          wMaster,
          verifier,
          createdAt: storedConfig.createdAt || new Date().toISOString(),
        };
        persist(next, oldKey);
        unlockMethodRef.current = 'master';
        touch();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [persist, touch]);

  const changeMaster = useCallback(async (currentPassword, nextPassword) => {
    const unlocked = await unlock(currentPassword);
    if (!unlocked) return false;
    const dataKey = keyRef.current;
    const kekSalt = randomSalt();
    const kek = await deriveKey(nextPassword, kekSalt, ITERATIONS);
    const wMaster = await wrapKey(dataKey, kek);
    persist({ ...readCfg(), kekSalt, wMaster, iterations: ITERATIONS });
    return true;
  }, [unlock, persist]);

  const enableBiometricUnlock = useCallback(async () => {
    if (!isAndroid()) return { ok: false, message: 'Biometric unlock is available in the Android app only.' };
    if (!keyRef.current) return { ok: false, message: 'Unlock PasKey with the Master Password first.' };
    if (unlockMethodRef.current !== 'master') {
      return { ok: false, message: 'Lock PasKey, then unlock it with your Master Password before enabling biometric unlock.' };
    }
    try {
      const rawDataKey = await exportDataKey(keyRef.current);
      biometricPromptActive.current = true;
      const result = await enableBiometricVaultKey(rawDataKey);
      if (!result?.enabled) return { ok: false, message: 'Android did not enable biometric unlock.' };
      updateSettings({ biometricUnlock: true });
      return { ok: true, message: 'Fingerprint or enrolled face unlock is now enabled.' };
    } catch (error) {
      return { ok: false, message: error?.message || 'Biometric unlock was not enabled. Enroll a fingerprint or face in Android settings, then try again.' };
    } finally {
      biometricPromptActive.current = false;
      backgroundAt.current = null;
    }
  }, [updateSettings]);

  const disableBiometricUnlock = useCallback(async () => {
    try { await clearBiometricVaultKey(); } catch { /* preference still turns off */ }
    updateSettings({ biometricUnlock: false });
    return true;
  }, [updateSettings]);

  const unlockWithBiometrics = useCallback(async () => {
    if (!settings.biometricUnlock) return { ok: false, message: 'Biometric unlock is not enabled. Use your Master Password.' };
    if (!isAndroid()) return { ok: false, message: 'Biometric unlock is available in the Android app only.' };
    try {
      biometricPromptActive.current = true;
      const rawDataKey = await unlockBiometricVaultKey();
      if (!rawDataKey) return { ok: false, message: 'Android did not return a biometric vault key. Use your Master Password.' };
      const dataKey = await importDataKey(rawDataKey);
      const storedConfig = readCfg();
      if (!storedConfig || (await decryptText(dataKey, storedConfig.verifier)) !== VERIFY_TOKEN) {
        return { ok: false, message: 'Biometric unlock could not verify this vault. Use your Master Password.' };
      }
      persist(storedConfig, dataKey);
      unlockMethodRef.current = 'biometric';
      touch();
      return { ok: true, message: '' };
    } catch (error) {
      const message = error?.message || 'Fingerprint or face unlock was not completed. Use your Master Password instead.';
      const resetRequired = message.includes('BIOMETRIC_KEY_INVALIDATED')
        || message.includes('must be enabled again');
      if (resetRequired) updateSettings({ biometricUnlock: false });
      return {
        ok: false,
        message: message.replace('BIOMETRIC_KEY_INVALIDATED: ', ''),
      };
    } finally {
      biometricPromptActive.current = false;
      backgroundAt.current = null;
    }
  }, [settings.biometricUnlock, persist, touch, updateSettings]);

  const enc = useCallback((text) => encryptText(keyRef.current, text), []);
  const dec = useCallback((payload) => decryptText(keyRef.current, payload), []);
  const repo = useMemo(() => (key ? createVaultRepository({ enc, dec }) : null), [key, enc, dec]);

  useEffect(() => {
    if (repo) syncAutofillVault(repo, dec).catch(() => {});
  }, [repo, dec]);

  const value = {
    hasVault: !!config,
    config,
    unlocked: !!key,
    key,
    setup,
    unlock,
    unlockWithBiometrics,
    enableBiometricUnlock,
    disableBiometricUnlock,
    lock,
    changeMaster,
    enc,
    dec,
    repo,
    settings,
    updateSettings,
  };

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}
