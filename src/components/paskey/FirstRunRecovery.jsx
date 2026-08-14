import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import Logo from './Logo';
import { useVault } from './VaultContext';
import { callRecovery } from '@/lib/recovery';

// Shown once right after the first Master Password is created. Optional: the
// user can add a recovery email (verified by a 6-digit code) or skip.
export default function FirstRunRecovery() {
  const { beginRecoverySetup, saveRecovery, completeFirstRun } = useVault();
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState('intro'); // intro | code | done
  const [code, setCode] = useState('');
  const [wRecovery, setWRecovery] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const send = async () => {
    setMsg(''); setBusy(true);
    try {
      const { wRecovery: w } = await beginRecoverySetup(email);
      setWRecovery(w); setPhase('code'); setMsg('A 6-digit verification code was sent to your email.');
    } catch (e) {
      setMsg(e.message || 'Unable to send code.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setMsg(''); setBusy(true);
    try {
      const r = await callRecovery({ action: 'sendCode', email });
      setMsg(r.ok ? 'A new code was sent.' : (r.error || 'Unable to resend.'));
    } catch {
      setMsg('Unable to resend.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setMsg(''); setBusy(true);
    try {
      const r = await callRecovery({ action: 'confirmRecovery', email, code });
      if (!r.ok) { setMsg(r.error || 'Invalid code.'); setBusy(false); return; }
      saveRecovery(email, wRecovery);
      setPhase('done');
    } catch {
      setMsg('Unable to verify.'); setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Logo size={56} />

      {phase === 'intro' && (
        <>
          <h1 className="mt-6 font-heading text-2xl text-white">Add Recovery Email</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#AEB4BE]">
            Your recovery email can help you regain access to your PasKey vault if you forget your Master Password.
            It is optional — you can skip this and add it later in Settings.
          </p>
          <div className="mt-6 space-y-3">
            <div>
              <label htmlFor="re" className="text-xs uppercase tracking-widest text-[#AEB4BE]">Email Address</label>
              <input
                id="re" type="email" inputMode="email" autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[#C8A96B]"
              />
            </div>
            <button
              type="button" disabled={busy || !email} onClick={send}
              className="w-full rounded-xl bg-white py-3.5 font-medium text-black transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Send Verification Code'}
            </button>
            {msg && <p className="text-xs" style={{ color: '#C8A96B' }}>{msg}</p>}
            <button type="button" onClick={completeFirstRun} className="w-full text-xs text-[#AEB4BE] underline decoration-dotted">
              Skip for now
            </button>
          </div>
        </>
      )}

      {phase === 'code' && (
        <>
          <h1 className="mt-6 font-heading text-2xl text-white">Verify Your Email</h1>
          <p className="mt-2 text-sm text-[#AEB4BE]">Enter the 6-digit code sent to {email}.</p>
          <div className="mt-6 space-y-3">
            <input
              type="text" inputMode="numeric" maxLength={6} aria-label="Verification code" value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-lg tracking-[0.5em] text-white outline-none focus:border-[#C8A96B]"
            />
            <button
              type="button" disabled={busy || code.length !== 6} onClick={verify}
              className="w-full rounded-xl bg-white py-3.5 font-medium text-black transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? 'Verifying…' : 'Verify'}
            </button>
            <button type="button" disabled={busy} onClick={resend} className="w-full text-xs text-[#AEB4BE] underline decoration-dotted">
              Resend code
            </button>
            {msg && <p className="text-xs" style={{ color: '#C8A96B' }}>{msg}</p>}
          </div>
        </>
      )}

      {phase === 'done' && (
        <>
          <div className="mt-6 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'rgba(200,169,107,0.15)' }}>
            <ShieldCheck className="h-6 w-6" style={{ color: '#C8A96B' }} />
          </div>
          <h1 className="mt-5 font-heading text-2xl text-white">Recovery Email Added Successfully</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#AEB4BE]">
            If you forget your Master Password, you can use {email} to securely re-wrap your vault key and set a new one.
          </p>
          <button
            type="button" onClick={completeFirstRun}
            className="mt-8 w-full rounded-xl bg-white py-3.5 font-medium text-black transition-transform active:scale-[0.98]"
          >
            Continue to vault
          </button>
        </>
      )}

      <div className="mt-8 flex gap-3 rounded-xl border border-white/10 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#C8A96B' }} aria-hidden="true" />
        <p className="text-xs leading-relaxed text-[#AEB4BE]">
          PasKey never stores or sends your Master Password. The recovery email verifies it is you, then re-wraps your
          vault encryption key with a new password — the old password is never recovered.
        </p>
      </div>
    </div>
  );
}