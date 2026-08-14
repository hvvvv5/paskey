import React, { useState } from 'react';
import { Mail, ShieldCheck } from 'lucide-react';
import { useVault } from './VaultContext';
import { callRecovery } from '@/lib/recovery';

// Settings management for the optional recovery email: add, change, or remove.
export default function RecoveryEmailSettings() {
  const { config, beginRecoverySetup, saveRecovery, removeRecovery } = useVault();
  const hasRecovery = !!config?.recoveryEmail;
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState('email'); // email | code
  const [code, setCode] = useState('');
  const [wRecovery, setWRecovery] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const reset = () => { setEmail(''); setCode(''); setWRecovery(null); setPhase('email'); setMsg(''); };

  const send = async () => {
    setMsg(''); setBusy(true);
    try {
      const { wRecovery: w } = await beginRecoverySetup(email);
      setWRecovery(w); setPhase('code'); setMsg('A 6-digit code was sent.');
    } catch (e) {
      setMsg(e.message || 'Unable to send.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setMsg(''); setBusy(true);
    try {
      const r = await callRecovery({ action: 'confirmRecovery', email, code });
      if (!r.ok) { setMsg(r.error || 'Invalid code.'); setBusy(false); return; }
      saveRecovery(email, wRecovery); setOpen(false); reset();
    } catch {
      setMsg('Unable to verify.'); setBusy(false);
    }
  };

  const remove = async () => {
    setMsg(''); setBusy(true);
    try {
      await removeRecovery();
      setMsg('Recovery email removed.');
    } catch {
      setMsg('Unable to remove.');
    } finally {
      setBusy(false);
    }
  };

  if (!open && hasRecovery) {
    return (
      <div className="border-b border-white/5 py-4">
        <div className="flex items-center gap-2 text-sm">
          <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: '#C8A96B' }} />
          <span className="flex-1 text-white">Recovery email</span>
          <span className="truncate text-xs text-[#AEB4BE]">{config.recoveryEmail}</span>
        </div>
        <div className="mt-3 flex gap-3">
          <button type="button" onClick={() => { reset(); setOpen(true); }} className="text-xs underline decoration-dotted" style={{ color: '#C8A96B' }}>Change</button>
          <button type="button" disabled={busy} onClick={remove} className="text-xs text-red-400/80 underline decoration-dotted">Remove</button>
        </div>
        {msg && <p className="mt-2 text-xs" style={{ color: '#C8A96B' }}>{msg}</p>}
      </div>
    );
  }

  if (!open && !hasRecovery) {
    return (
      <div className="border-b border-white/5 py-4">
        <button type="button" onClick={() => { reset(); setOpen(true); }} className="flex w-full items-center text-sm">
          <Mail className="mr-2 h-4 w-4 shrink-0" style={{ color: '#C8A96B' }} />
          <span className="flex-1 text-left text-white">Recovery email</span>
          <span className="text-xs text-[#AEB4BE]">Add</span>
        </button>
        {msg && <p className="mt-2 text-xs" style={{ color: '#C8A96B' }}>{msg}</p>}
      </div>
    );
  }

  return (
    <div className="border-b border-white/5 py-4">
      <p className="text-sm text-white">{hasRecovery ? 'Change recovery email' : 'Add recovery email'}</p>
      {phase === 'email' && (
        <div className="mt-3 space-y-3">
          <input
            type="email" placeholder="email@example.com" aria-label="Recovery email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#C8A96B]"
          />
          <div className="flex gap-2">
            <button type="button" disabled={busy || !email} onClick={send} className="flex-1 rounded-xl bg-white py-3 text-sm font-medium text-black active:scale-[0.98] disabled:opacity-60">
              {busy ? 'Sending…' : 'Send Code'}
            </button>
            <button type="button" onClick={() => { setOpen(false); reset(); }} className="rounded-xl border border-white/10 px-4 text-sm text-[#AEB4BE]">Cancel</button>
          </div>
        </div>
      )}
      {phase === 'code' && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-[#AEB4BE]">Code sent to {email}.</p>
          <input
            type="text" inputMode="numeric" maxLength={6} aria-label="Verification code" value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-lg tracking-[0.5em] text-white outline-none focus:border-[#C8A96B]"
          />
          <div className="flex gap-2">
            <button type="button" disabled={busy || code.length !== 6} onClick={verify} className="flex-1 rounded-xl bg-white py-3 text-sm font-medium text-black active:scale-[0.98] disabled:opacity-60">
              {busy ? 'Verifying…' : 'Verify'}
            </button>
            <button type="button" disabled={busy} onClick={send} className="rounded-xl border border-white/10 px-4 text-sm text-[#AEB4BE]">Resend</button>
          </div>
        </div>
      )}
      {msg && <p className="mt-2 text-xs" style={{ color: '#C8A96B' }}>{msg}</p>}
    </div>
  );
}