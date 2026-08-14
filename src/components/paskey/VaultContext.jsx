import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { deriveKey, encryptText, decryptText, randomSalt, ITERATIONS, VERIFY_TOKEN } from '@/lib/crypto';
import { loadSettings, saveSettings } from '@/lib/settings';

const CFG = 'paskey.vault.config';
const VaultContext = createContext(null);
export const useVault = () => useContext(VaultContext);

const readCfg = () => {
  try { return JSON.parse(localStorage.getItem(CFG) || 'null'); } catch { return null; }
};

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

  const setup = useCallback(async (password) => {
    const salt = randomSalt();
    const k = await deriveKey(password, salt, ITERATIONS);
    const verifier = await encryptText(k, VERIFY_TOKEN);
    const next = { salt, iterations: ITERATIONS, verifier, kdf: 'PBKDF2-HMAC-SHA256', createdAt: new Date().toISOString() };
    localStorage.setItem(CFG, JSON.stringify(next));
    setConfig(next);
    keyRef.current = k;
    setKey(k);
    touch();
  }, [touch]);

  const unlock = useCallback(async (password) => {
    const cfg = readCfg();
    if (!cfg) return false;
    const k = await deriveKey(password, cfg.salt, cfg.iterations);
    const check = await decryptText(k, cfg.verifier);
    if (check !== VERIFY_TOKEN) return false;
    keyRef.current = k;
    setKey(k);
    touch();
    return true;
  }, [touch]);

  const changeMaster = useCallback(async (current, next) => {
    const ok = await unlock(current);
    if (!ok) return false;
    await setup(next);
    return true;
  }, [unlock, setup]);

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
    hasVault: !!config, config, unlocked: !!key, key,
    setup, unlock, lock, changeMaster, enc, dec,
    settings, updateSettings,
  };
  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}