import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  deriveKey, encryptText, decryptText, randomSalt, ITERATIONS, VERIFY_TOKEN,
  generateDataKey, importRaw, wrapKey, unwrapKey, generateRecoveryKey,
} from '@/lib/crypto';
import { loadSettings, saveSettings } from '@/lib/settings';
import { callRecovery } from '@/lib/recovery';

const CFG = 'paskey.vault.config';
const VaultContext = createContext(null);
export const useVault = () => useContext(VaultContext);

const readCfg = () => {
  try { return JSON.parse(localStorage.getItem(CFG) || 'null'); } catch { return null; }
};
const writeCfg = (cfg) => localStorage.setItem(CFG, JSON.stringify(cfg));

export function VaultProvider({ children }) {
  const [config, setConfig] = useState(readCfg);
  const [settings, setSettings] = useState(loadSettings);
  const [key, setKey] = useState(null);
  const [firstRun, setFirstRun] = useState(false);
  const keyRef = useRef(null);
  const timer = useRef(null);

  const lock = useCallback(() => {
    keyRef.current = null;
    setKey(null);
  }, []);

  const touch = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    const m = settings.autoLockMinutes;
    if (!keyRef.current || m === -1) return;
    if (m === 0) return;
    timer.current = setTimeout(lock, m * 60 * 1000);
  }, [settings.autoLockMinutes, lock]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden' && settings.autoLockMinutes === 0) lock();
    };
    const events = ['pointerdown', 'keydown'];
    events.forEach((e) => window.addEventListener(e, touch));
    document.addEventListener('visibilitychange', onVis);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [touch, lock, settings.autoLockMinutes]);

  const persist = useCallback((cfg, k) => {
    writeCfg(cfg);
    setConfig(cfg);
    if (k !== undefined) {
      keyRef.current = k;
      setKey(k);
    }
  }, []);

  // Create a brand-new vault: random data key K wrapped with a master-password KEK.
  const setup = useCallback(async (password) => {
    const k = await generateDataKey();
    const kekSalt = randomSalt();
    const kek = await deriveKey(password, kekSalt, ITERATIONS);
    const wMaster = await wrapKey(k, kek);
    const verifier = await encryptText(k, VERIFY_TOKEN);
    const next = { version: 2, kekSalt, iterations: ITERATIONS, kdf: 'PBKDF2-HMAC-SHA256', wMaster, wRecovery: null, recoveryEmail: null, verifier, createdAt: new Date().toISOString() };
    persist(next, k);
    setFirstRun(true);
    touch();
  }, [persist, touch]);

  const unlock = useCallback(async (password) => {
    const cfg = readCfg();
    if (!cfg) return false;
    try {
      if (cfg.version === 2) {
        const kek = await deriveKey(password, cfg.kekSalt, cfg.iterations);
        const k = await unwrapKey(cfg.wMaster, kek);
        if ((await decryptText(k, cfg.verifier)) !== VERIFY_TOKEN) return false;
        keyRef.current = k; setKey(k); touch();
        return true;
      }
      // Migrate a v1 vault (key = KDF(masterPassword)) to the wrapped-key model.
      // The old derived key is reused as the data key K so existing ciphertext
      // still decrypts; we then wrap it with a fresh master-password KEK.
      if (cfg.salt) {
        const kOld = await deriveKey(password, cfg.salt, cfg.iterations);
        if ((await decryptText(kOld, cfg.verifier)) !== VERIFY_TOKEN) return false;
        const kekSalt = randomSalt();
        const kek = await deriveKey(password, kekSalt, cfg.iterations || ITERATIONS);
        const wMaster = await wrapKey(kOld, kek);
        const verifier = await encryptText(kOld, VERIFY_TOKEN);
        const next = { version: 2, kekSalt, iterations: cfg.iterations || ITERATIONS, kdf: 'PBKDF2-HMAC-SHA256', wMaster, wRecovery: null, recoveryEmail: null, verifier, createdAt: cfg.createdAt || new Date().toISOString() };
        persist(next, kOld); touch();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [persist, touch]);

  // Re-wrap the data key with a new master-password KEK. K is unchanged, so no
  // vault data is re-encrypted. (Also fixes the previous behavior of regenerating
  // the key, which would have orphaned all existing encrypted items.)
  const changeMaster = useCallback(async (current, next) => {
    const ok = await unlock(current);
    if (!ok) return false;
    const k = keyRef.current;
    const kekSalt = randomSalt();
    const kek = await deriveKey(next, kekSalt, ITERATIONS);
    const wMaster = await wrapKey(k, kek);
    const cfg = readCfg();
    persist({ ...cfg, kekSalt, wMaster, iterations: ITERATIONS });
    return true;
  }, [unlock, persist]);

  // Begin optional recovery setup (vault must be unlocked): generate R, wrap K
  // with R, and ask the backend to store R + send a verification code.
  const beginRecoverySetup = useCallback(async (email) => {
    const k = keyRef.current;
    const cfg = readCfg();
    if (!k || !cfg || cfg.version !== 2) throw new Error('Vault must be unlocked.');
    const R = generateRecoveryKey();
    const wRecovery = await wrapKey(k, await importRaw(R));
    const r = await callRecovery({ action: 'initRecovery', email, recoveryKey: R });
    if (!r.ok) throw new Error(r.error || 'Unable to start recovery setup.');
    return { wRecovery };
  }, []);

  // Persist the recovery email + wrapped key after the email has been verified.
  const saveRecovery = useCallback((email, wRecovery) => {
    const cfg = readCfg();
    persist({ ...cfg, recoveryEmail: email, wRecovery });
  }, [persist]);

  const removeRecovery = useCallback(async () => {
    await callRecovery({ action: 'disable' });
    const cfg = readCfg();
    persist({ ...cfg, wRecovery: null, recoveryEmail: null });
  }, [persist]);

  const completeFirstRun = useCallback(() => setFirstRun(false), []);

  // Forgot-password recovery: unwrap K with R (released by the backend after
  // email verification), verify it against the stored token, then re-wrap K with
  // a new master-password KEK. Does NOT unlock — the user must authenticate with
  // the new password.
  const recoverWithKey = useCallback(async (newPassword, recoveryKeyB64) => {
    const cfg = readCfg();
    if (!cfg || !cfg.wRecovery) throw new Error('No recovery configured for this vault.');
    const k = await unwrapKey(cfg.wRecovery, await importRaw(recoveryKeyB64));
    if ((await decryptText(k, cfg.verifier)) !== VERIFY_TOKEN) throw new Error('Recovery failed: vault key could not be verified.');
    const kekSalt = randomSalt();
    const kek = await deriveKey(newPassword, kekSalt, ITERATIONS);
    const wMaster = await wrapKey(k, kek);
    persist({ ...cfg, kekSalt, wMaster, iterations: ITERATIONS });
    return true;
  }, [persist]);

  const updateSettings = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const enc = useCallback((text) => encryptText(keyRef.current, text), []);
  const dec = useCallback((payload) => decryptText(keyRef.current, payload), []);

  const value = {
    hasVault: !!config, config, unlocked: !!key, key, firstRun,
    setup, unlock, lock, changeMaster, enc, dec,
    beginRecoverySetup, saveRecovery, removeRecovery, recoverWithKey, completeFirstRun,
    settings, updateSettings,
  };
  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}