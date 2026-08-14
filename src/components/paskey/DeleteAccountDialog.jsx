import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function DeleteAccountDialog({ open, onClose }) {
  const [step, setStep] = useState(1);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) { setStep(1); setTyped(''); setError(''); setBusy(false); }
  }, [open]);

  const doDelete = async () => {
    setBusy(true);
    setError('');
    try {
      await base44.functions.invoke('deleteAccount', {});
      await base44.auth.logout('/login');
    } catch {
      setError('Unable to delete your account. Please try again.');
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 px-5 pb-[env(safe-area-inset-bottom)] sm:items-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#070707] p-6"
            initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            {step === 1 ? (
              <>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" style={{ color: '#C8A96B' }} aria-hidden="true" />
                  <h2 className="font-heading text-lg text-white">Delete account?</h2>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[#AEB4BE]">
                  This permanently deletes your Base44 user account. Your local encrypted vault stays on this device
                  until you clear app data. This action cannot be undone.
                </p>
                <div className="mt-5 flex gap-3">
                  <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-white/10 py-3 text-sm text-[#AEB4BE]">Cancel</button>
                  <button type="button" onClick={() => setStep(2)} className="flex-1 rounded-xl bg-red-500/90 py-3 text-sm font-medium text-white">Continue</button>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-heading text-lg text-white">Are you absolutely sure?</h2>
                <p className="mt-2 text-sm text-[#AEB4BE]">
                  Type <span className="font-mono text-white">DELETE</span> to confirm.
                </p>
                <input
                  type="text" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off"
                  aria-label="Type DELETE to confirm"
                  className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-red-500"
                />
                {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
                <div className="mt-5 flex gap-3">
                  <button type="button" onClick={onClose} disabled={busy} className="flex-1 rounded-xl border border-white/10 py-3 text-sm text-[#AEB4BE]">Cancel</button>
                  <button type="button" onClick={doDelete} disabled={busy || typed !== 'DELETE'} className="flex-1 rounded-xl bg-red-500/90 py-3 text-sm font-medium text-white disabled:opacity-50">
                    {busy ? 'Deleting…' : 'Delete forever'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}