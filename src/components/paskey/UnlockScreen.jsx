import React, { useState } from 'react';
import { Fingerprint } from 'lucide-react';
import Logo from './Logo';
import { useVault } from './VaultContext';

export default function UnlockScreen() {
  const { unlock, unlockWithBiometrics, settings } = useVault();
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const ok = await unlock(pw);
    setBusy(false);
    if (!ok) setError('Incorrect Master Password. Unable to unlock PasKey.');
    setPw('');
  };

  const biometricUnlock = async () => {
    if (biometricBusy) return;
    setBiometricBusy(true);
    setError('');
    const result = await unlockWithBiometrics();
    setBiometricBusy(false);
    if (!result.ok) setError(result.message || 'Fingerprint or face unlock was not completed. Use your Master Password instead.');
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <span className="pk-logo-badge flex h-16 w-16 items-center justify-center rounded-full" aria-hidden="true"><Logo size={44} /></span>
      <h1 className="mt-6 font-heading text-2xl text-white">Welcome back</h1>
      <p className="mt-2 text-sm text-[#AEB4BE]">Unlock your PasKey vault.</p>

      {settings.biometricUnlock ? (
        <button type="button" onClick={biometricUnlock} disabled={biometricBusy} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#C8A96B]/50 py-3.5 text-sm font-medium text-[#C8A96B] disabled:opacity-60">
          <Fingerprint className="h-5 w-5" />
          {biometricBusy ? 'Waiting for Android…' : 'Use fingerprint or secure face'}
        </button>
      ) : null}

      <form onSubmit={submit} className="mt-5 space-y-4">
        <input type="password" autoComplete="current-password" aria-label="Master Password" value={pw} onChange={(event) => setPw(event.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[#C8A96B]" />
        {error ? <p role="alert" className="text-sm text-red-400">{error}</p> : null}
        <button type="submit" disabled={busy || biometricBusy} className="w-full rounded-xl bg-white py-3.5 font-medium text-black transition-transform active:scale-[0.98] disabled:opacity-60">
          {busy ? 'Unlocking…' : 'Unlock with Master Password'}
        </button>
      </form>

      <p className="mt-4 text-center text-xs leading-relaxed text-[#AEB4BE]/70">If you forget your Master Password, your vault cannot be decrypted by anyone — including PasKey.</p>
      {settings.biometricUnlock ? <p className="mt-4 text-center text-xs leading-relaxed text-[#AEB4BE]/70">Android verifies an enrolled strong fingerprint or secure face. PasKey never sees or stores biometric data.</p> : null}
    </div>
  );
}
