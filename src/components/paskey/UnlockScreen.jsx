import React, { useState } from 'react';
import { Fingerprint } from 'lucide-react';
import Logo from './Logo';
import { useVault } from './VaultContext';
import ForgotMasterPassword from './ForgotMasterPassword';

export default function UnlockScreen() {
  const { unlock, settings } = useVault();
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const ok = await unlock(pw);
    setBusy(false);
    if (!ok) setError('Incorrect Master Password. Unable to unlock PasKey.');
    setPw('');
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Logo size={56} />
      <h1 className="mt-6 font-heading text-2xl text-white">Unlock PasKey</h1>
      <p className="mt-2 text-sm text-[#AEB4BE]">Enter your Master Password to decrypt your vault.</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <input
          type="password" autoComplete="current-password" aria-label="Master Password"
          value={pw} onChange={(e) => setPw(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[#C8A96B]"
        />
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <button
          type="submit" disabled={busy}
          className="w-full rounded-xl bg-white py-3.5 font-medium text-black transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>

      <button type="button" onClick={() => setForgot(true)} className="mt-4 w-full text-center text-xs text-[#AEB4BE] underline decoration-dotted">
        Forgot Master Password?
      </button>

      {settings.biometricUnlock && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-white/10 p-4">
          <Fingerprint className="h-5 w-5" style={{ color: '#C8A96B' }} aria-hidden="true" />
          <p className="text-xs leading-relaxed text-[#AEB4BE]">
            Biometric unlock is enabled. On the native Android build, BiometricPrompt runs here and unlocks the
            Keystore-protected vault key — it is not simulated in this layer.
          </p>
        </div>
      )}

      {forgot && <ForgotMasterPassword onClose={() => setForgot(false)} />}
    </div>
  );
}