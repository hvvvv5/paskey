import React, { useState } from 'react';
import { useVault } from './VaultContext';
import { scorePassword } from '@/lib/password';

export default function ChangeMasterPassword() {
  const { changeMaster } = useVault();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState('');
  const { label } = scorePassword(next);

  const submit = async (e) => {
    e.preventDefault();
    setMsg('');
    if (next.length < 12) return setMsg('New Master Password must be at least 12 characters.');
    const ok = await changeMaster(current, next);
    setCurrent(''); setNext('');
    if (!ok) return setMsg('Incorrect Master Password. Unable to unlock PasKey.');
    setMsg('Master Password updated. Your vault key was re-wrapped — all items remain accessible.');
    setOpen(false);
  };

  return (
    <div className="border-b border-white/5 py-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center text-sm">
        <span className="flex-1 text-left text-white">Master Password</span>
        <span className="text-xs text-[#AEB4BE]">{open ? 'Cancel' : 'Change'}</span>
      </button>
      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input
            type="password" placeholder="Current Master Password" aria-label="Current Master Password"
            value={current} onChange={(e) => setCurrent(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#C8A96B]"
          />
          <input
            type="password" placeholder="New Master Password" aria-label="New Master Password"
            value={next} onChange={(e) => setNext(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#C8A96B]"
          />
          <p className="text-xs text-[#AEB4BE]">Strength: <span className="text-white">{label}</span></p>
          <button type="submit" className="w-full rounded-xl bg-white py-3 text-sm font-medium text-black active:scale-[0.98]">Update Master Password</button>
        </form>
      )}
      {msg && <p className="mt-3 text-xs text-[#AEB4BE]">{msg}</p>}
    </div>
  );
}