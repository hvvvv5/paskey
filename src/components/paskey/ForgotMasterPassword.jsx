import React, { useState } from 'react';
import { X, ShieldCheck, Fingerprint } from 'lucide-react';
import Logo from './Logo';
import { useVault } from './VaultContext';
import { callRecovery } from '@/lib/recovery';
import { scorePassword } from '@/lib/password';

// Forgot Master Password wizard, launched from the lock screen.
// Flow: email → 6-digit code → new master password → success → back to unlock.
export default function ForgotMasterPassword({ onClose }) {
  const { config, recoverWithKey, settings } = useVault();
  const hasRecovery = !!config?.recoveryEmail;
  const [step, setStep] = useState(hasRecovery ? 'email' : 'none');
  const [email, setEmail] = useState(config?.recoveryEmail || '');
  const [code, setCode] = useState('');
  const [recoveryKey, setRecoveryKey] = useState(null);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const { score, label } = scorePassword(newPw);

  const sendCode = async () => {
    setMsg(''); setBusy(true);
    try {
      const r = await callRecovery({ action: 'sendCode', email });
      if (!r.ok) { setMsg(r.error || 'Unable to send code.'); setBusy(false); return; }
      setStep('code'); setMsg('A 6-digit code was sent to your email.');
    } catch {
      setMsg('Unable to send code.');
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
      const r = await callRecovery({ action: 'recoverVerifyCode', email, code });
      if (!r.ok || !r.recoveryKey) { setMsg(r.error || 'Invalid code.'); setBusy(false); return; }
      setRecoveryKey(r.recoveryKey); setStep('reset');
    } catch {
      setMsg('Unable to verify.'); setBusy(false);
    }
  };

  const reset = async () => {
    setMsg('');
    if (newPw.length < 12) { setMsg('New Master Password must be at least 12 characters.'); return; }
    if (newPw !== confirmPw) { setMsg('Passwords do not match.'); return; }
    setBusy(true);
    try {
      await recoverWithKey(newPw, recoveryKey);
      setStep('done');
    } catch (e) {
      setMsg(e.message || 'Unable to reset.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#070707] p-6">
        <button type="button" aria-label="Close" onClick={onClose} className="absolute right-4 top-4 rounded-lg p-2 text-[#AEB4BE] hover:text-white active:scale-95">
          <X className="h-5 w-5" />
        </button>
        <Logo size={36} />

        {step === 'none' && (
          <>
            <h1 className="mt-4 font-heading text-xl text-white">Forgot Master Password</h1>
            <p className="mt-2 text-sm leading-relaxed text-[#AEB4BE]">
              No recovery email is configured for this vault. Without it, your Master Password cannot be recovered and
              the vault cannot be decrypted by anyone — including PasKey.
            </p>
            <button type="button" onClick={onClose} className="mt-6 w-full rounded-xl border border-white/10 py-3 text-sm text-white active:scale-[0.98]">
              Back to unlock
            </button>
          </>
        )}

        {step === 'email' && (
          <>
            <h1 className="mt-4 font-heading text-xl text-white">Recovery Email</h1>
            <p className="mt-2 text-sm text-[#AEB4BE]">Enter your recovery email to receive a verification code.</p>
            <div className="mt-5 space-y-3">
              <input
                type="email" inputMode="email" placeholder="email@example.com" aria-label="Recovery email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[#C8A96B]"
              />
              <button
                type="button" disabled={busy || !email} onClick={sendCode}
                className="w-full rounded-xl bg-white py-3.5 font-medium text-black transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                {busy ? 'Sending…' : 'Send Verification Code'}
              </button>
              {msg && <p className="text-xs" style={{ color: '#C8A96B' }}>{msg}</p>}
            </div>
          </>
        )}

        {step === 'code' && (
          <>
            <h1 className="mt-4 font-heading text-xl text-white">Verification Code</h1>
            <p className="mt-2 text-sm text-[#AEB4BE]">Enter the 6-digit code sent to your email.</p>
            <div className="mt-5 space-y-3">
              <input
                type="text" inputMode="numeric" maxLength={6} aria-label="6-digit verification code" value={code}
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

        {step === 'reset' && (
          <>
            <h1 className="mt-4 font-heading text-xl text-white">Create New Master Password</h1>
            <div className="mt-5 space-y-3">
              <input
                type="password" placeholder="New Master Password" aria-label="New Master Password" value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[#C8A96B]"
              />
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: score < 55 ? '#AEB4BE' : '#C8A96B' }} />
              </div>
              <p className="text-xs text-[#AEB4BE]">Strength: <span className="text-white">{label}</span> · minimum 12 characters</p>
              <input
                type="password" placeholder="Confirm New Master Password" aria-label="Confirm New Master Password" value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[#C8A96B]"
              />
              <button
                type="button" disabled={busy} onClick={reset}
                className="w-full rounded-xl bg-white py-3.5 font-medium text-black transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                {busy ? 'Resetting…' : 'Reset Master Password'}
              </button>
              {msg && <p role="alert" className="text-xs text-red-400">{msg}</p>}
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <div className="mt-5 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'rgba(200,169,107,0.15)' }}>
              <ShieldCheck className="h-6 w-6" style={{ color: '#C8A96B' }} />
            </div>
            <h1 className="mt-4 font-heading text-xl text-white">Master Password Changed Successfully</h1>
            <p className="mt-2 text-sm leading-relaxed text-[#AEB4BE]">
              Your vault key has been re-wrapped with your new Master Password. Authenticate with it to unlock PasKey.
            </p>
            {settings.biometricUnlock && (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 p-3">
                <Fingerprint className="h-4 w-4 shrink-0" style={{ color: '#C8A96B' }} />
                <p className="text-xs text-[#AEB4BE]">Biometric re-authentication is enforced by the native Android layer after recovery.</p>
              </div>
            )}
            <button type="button" onClick={onClose} className="mt-6 w-full rounded-xl bg-white py-3.5 font-medium text-black transition-transform active:scale-[0.98]">
              Unlock PasKey
            </button>
          </>
        )}
      </div>
    </div>
  );
}