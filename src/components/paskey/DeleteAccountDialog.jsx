import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { CATEGORIES } from '@/lib/categories';
import { clearBiometricVaultKey, clearNativeAutofillVault, clearNativeVaultStorage } from '@/lib/native/PasKeySecurity';

const CFG = 'paskey.vault.config';
const SETTINGS = 'paskey.settings';
const dataKey = (entity) => `paskey.data.${entity}`;

export default function DeleteAccountDialog({ open, onClose }) {
  const [step, setStep] = useState(1);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) { setStep(1); setTyped(''); setBusy(false); }
  }, [open]);

  const doErase = async () => {
    setBusy(true);
    try {
      // These calls only run after the explicit ERASE confirmation. They are
      // intentionally separate from ordinary app upgrades and locking.
      await Promise.all([clearBiometricVaultKey(), clearNativeAutofillVault(), clearNativeVaultStorage()]);
      localStorage.removeItem(CFG);
      localStorage.removeItem(SETTINGS);
      CATEGORIES.forEach((category) => localStorage.removeItem(dataKey(category.entity)));
    } finally {
      window.location.href = '/';
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 px-5 pb-[env(safe-area-inset-bottom)] sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#070707] p-6" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} transition={{ duration: 0.2 }} onClick={(event) => event.stopPropagation()}>
            {step === 1 ? (
              <>
                <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-[#C8A96B]" /><h2 className="font-heading text-lg text-white">Erase local vault?</h2></div>
                <p className="mt-3 text-sm leading-relaxed text-[#AEB4BE]">This permanently erases the encrypted vault, native Autofill cache and biometric unlock wrapper from this device. There is no cloud copy and no recovery.</p>
                <div className="mt-5 flex gap-3"><button type="button" onClick={onClose} className="flex-1 rounded-xl border border-white/10 py-3 text-sm text-[#AEB4BE]">Cancel</button><button type="button" onClick={() => setStep(2)} className="flex-1 rounded-xl bg-red-500/90 py-3 text-sm font-medium text-white">Continue</button></div>
              </>
            ) : (
              <>
                <h2 className="font-heading text-lg text-white">Are you absolutely sure?</h2>
                <p className="mt-2 text-sm text-[#AEB4BE]">Type <span className="font-mono text-white">ERASE</span> to confirm.</p>
                <input type="text" value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" aria-label="Type ERASE to confirm" className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-red-500" />
                <div className="mt-5 flex gap-3"><button type="button" onClick={onClose} disabled={busy} className="flex-1 rounded-xl border border-white/10 py-3 text-sm text-[#AEB4BE]">Cancel</button><button type="button" onClick={doErase} disabled={busy || typed !== 'ERASE'} className="flex-1 rounded-xl bg-red-500/90 py-3 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Erasing…' : 'Erase forever'}</button></div>
              </>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
