import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  deriveKey, encryptText, decryptText, randomSalt, ITERATIONS, VERIFY_TOKEN,
  generateDataKey, wrapKey, unwrapKey,
} from '@/lib/crypto';
import { loadSettings, saveSettings } from '@/lib/settings';
import { createVaultRepository } from '@/lib/repository/vaultRepository';

const CFG = 'paskey.vault.config';
const VaultContext = createContext(null);
export const useVault = () => useContext(VaultContext);

const readCfg = () => {
  try { return JSON.parse(localStorage.getItem(CFG) || 'null'); } catch { return null; }
};
const writeCfg = (cfg) => localStorage.setItem(CFG, JSON.stringify(cfg));

// Wrapped vault-key architecture:
//   Master Password → KDF (PBKDF2-HMAC-SHA256) → KEK → wrapped vault data key K
// K is a random AES-256 data key, independent of the Master Password. Changing
// the Master Password only re-wraps K (a new KEK wraps the same K), so vault
// data is never re-encrypted and the old Master Password is never recoverable.
// There is no server-backed recovery: forgetting the Master Password means the
// vault cannot be decrypted by anyone — including PasKey.

export function VaultProvider({ children }) {
  const [config, setConfig] = useState(readCfg);
  const [settings, setSettings] = useState(loadSettings);
  const [key, setKey] = useState(null);
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
    const next = { version: 2, kekSalt, iterations: ITERATIONS, kdf: 'PBKDF2-HMAC-SHA256', wMaster, verifier, createdAt: new Date().toISOString() };
    persist(next, k);
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
        const next = { version: 2, kekSalt, iterations: cfg.iterations || ITERATIONS, kdf: 'PBKDF2-HMAC-SHA256', wMaster, verifier, createdAt: cfg.createdAt || new Date().toISOString() };
        persist(next, kOld); touch();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [persist, touch]);

  // Re-wrap the data key with a new master-password KEK. K is unchanged, so no
  // vault data is re-encrypted and the old Master Password is never recoverable.
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

  const updateSettings = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const enc = useCallback((text) => encryptText(keyRef.current, text), []);
  const dec = useCallback((payload) => decryptText(keyRef.current, payload), []);

  const repo = useMemo(() => (key ? createVaultRepository({ enc, dec }) : null), [key, enc, dec]);

  const value = {
    hasVault: !!config, config, unlocked: !!key, key,
    setup, unlock, lock, changeMaster, enc, dec, repo,
    settings, updateSettings,
  };
  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}