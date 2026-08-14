import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Logo from './Logo';
import { scorePassword, generatePassword } from '@/lib/password';
import { useVault } from './VaultContext';

export default function MasterPasswordSetup() {
  const { setup } = useVault();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { score, label } = scorePassword(pw);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (pw.length < 12) return setError('Master Password must be at least 12 characters.');
    if (pw !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await setup(pw);
    } catch {
      setError('Unable to create your vault. Please try again.');
    } finally {
      setBusy(false);
      setPw('');
      setConfirm('');
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Logo size={56} />
      <h1 className="mt-6 font-heading text-2xl text-white">Create your Master Password</h1>
      <p className="mt-2 text-sm leading-relaxed text-[#AEB4BE]">
        Your passwords. Protected. Ready when you need them. No account, no email — your vault key is derived from this
        password alone.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="mp" className="text-xs uppercase tracking-widest text-[#AEB4BE]">Master Password</label>
          <input
            id="mp" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[#C8A96B]"
          />
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${score}%`, backgroundColor: score < 55 ? '#AEB4BE' : '#C8A96B' }} />
          </div>
          <p className="mt-2 text-xs text-[#AEB4BE]">Strength: <span className="text-white">{label}</span> · minimum 12 characters</p>
          <button
            type="button"
            onClick={() => { const s = generatePassword({ length: 20 }); setPw(s); setConfirm(s); }}
            className="mt-2 text-xs underline decoration-dotted" style={{ color: '#C8A96B' }}
          >
            Suggest a strong password
          </button>
        </div>

        <div>
          <label htmlFor="mpc" className="text-xs uppercase tracking-widest text-[#AEB4BE]">Confirm</label>
          <input
            id="mpc" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[#C8A96B]"
          />
        </div>

        <div className="flex gap-3 rounded-xl border border-white/10 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#C8A96B' }} aria-hidden="true" />
          <p className="text-xs leading-relaxed text-[#AEB4BE]">
            Your Master Password cannot be recovered. If you forget it, your vault cannot be decrypted by anyone —
            including PasKey.
          </p>
        </div>

        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

        <button
          type="submit" disabled={busy}
          className="w-full rounded-xl bg-white py-3.5 font-medium text-black transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? 'Creating vault…' : 'Create vault'}
        </button>
      </form>
    </div>
  );
}