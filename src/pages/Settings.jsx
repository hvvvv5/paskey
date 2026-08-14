import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Download, Upload } from 'lucide-react';
import { useVault } from '@/components/paskey/VaultContext';
import { buildBackup, downloadBackup, restoreBackup } from '@/lib/backup';
import NativeNotice from '@/components/paskey/NativeNotice';
import ChangeMasterPassword from '@/components/paskey/ChangeMasterPassword';

const LOCK_OPTIONS = [
  [0, 'Immediately'], [1, '1 minute'], [5, '5 minutes'], [15, '15 minutes'], [30, '30 minutes'], [-1, 'Never'],
];

function Row({ children }) {
  return <div className="flex items-center gap-3 border-b border-white/5 py-4 text-sm">{children}</div>;
}

export default function Settings() {
  const { settings, updateSettings, config, lock } = useVault();
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);

  const exportBackup = async () => {
    setMsg('');
    try {
      downloadBackup(await buildBackup(config));
      setMsg('Encrypted backup created.');
    } catch {
      setMsg('Unable to create encrypted backup.');
    }
  };

  const onRestore = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg('');
    try {
      const n = await restoreBackup(file, config);
      setMsg(`Restored ${n} encrypted items.`);
    } catch (err) {
      setMsg(err.message || 'Unable to restore this backup.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="px-5 pb-28 pt-6">
      <h1 className="font-heading text-2xl text-white">Settings</h1>

      <h2 className="mt-6 text-xs uppercase tracking-widest text-[#AEB4BE]">Security</h2>
      <ChangeMasterPassword />
      <Row>
        <span className="flex-1 text-white">Biometric unlock</span>
        <input
          type="checkbox" aria-label="Biometric unlock" checked={settings.biometricUnlock}
          onChange={(e) => updateSettings({ biometricUnlock: e.target.checked })} className="h-5 w-5 accent-[#C8A96B]"
        />
      </Row>
      <Row>
        <span className="flex-1 text-white">Auto lock</span>
        <select
          aria-label="Auto lock timeout" value={settings.autoLockMinutes}
          onChange={(e) => updateSettings({ autoLockMinutes: Number(e.target.value) })}
          className="rounded-lg border border-white/10 bg-[#070707] px-3 py-2 text-[#AEB4BE]"
        >
          {LOCK_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Row>
      <Row>
        <span className="flex-1 text-white">Clear clipboard after</span>
        <select
          aria-label="Clipboard protection" value={settings.clipboardClearSeconds}
          onChange={(e) => updateSettings({ clipboardClearSeconds: Number(e.target.value) })}
          className="rounded-lg border border-white/10 bg-[#070707] px-3 py-2 text-[#AEB4BE]"
        >
          {[0, 15, 30, 60].map((s) => <option key={s} value={s}>{s === 0 ? 'Never' : `${s} seconds`}</option>)}
        </select>
      </Row>
      <Row>
        <span className="flex-1 text-white">Screenshot protection</span>
        <input
          type="checkbox" aria-label="Screenshot protection" checked={settings.screenshotProtection}
          onChange={(e) => updateSettings({ screenshotProtection: e.target.checked })} className="h-5 w-5 accent-[#C8A96B]"
        />
      </Row>
      <Row>
        <span className="flex-1 text-white">Require authentication to reveal secrets</span>
        <input
          type="checkbox" aria-label="Require authentication to reveal secrets" checked={settings.requireAuthToReveal}
          onChange={(e) => updateSettings({ requireAuthToReveal: e.target.checked })} className="h-5 w-5 accent-[#C8A96B]"
        />
      </Row>

      <div className="mt-4">
        <NativeNotice>
          Biometric unlock (BiometricPrompt), screenshot blocking (FLAG_SECURE) and OS-level clipboard clearing are
          enforced by the native Android layer. This layer stores your preference and applies the in-app equivalents it
          can (timeout locking and best-effort clipboard clearing).
        </NativeNotice>
      </div>

      <h2 className="mt-8 text-xs uppercase tracking-widest text-[#AEB4BE]">Vault</h2>
      <Row>
        <span className="flex-1 text-white">Encrypted backup</span>
        <button type="button" onClick={exportBackup} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-[#AEB4BE] hover:border-[#C8A96B]/50 hover:text-white">
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </Row>
      <Row>
        <span className="flex-1 text-white">Restore from backup</span>
        <input ref={fileRef} type="file" accept=".json" onChange={onRestore} className="hidden" />
        <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-[#AEB4BE] hover:border-[#C8A96B]/50 hover:text-white">
          <Upload className="h-3.5 w-3.5" /> Restore
        </button>
      </Row>
      {msg && <p className="mt-3 text-xs" style={{ color: '#C8A96B' }}>{msg}</p>}
      <p className="mt-2 text-[11px] leading-relaxed text-[#AEB4BE]/70">
        Exports use the PasKey Encrypted Vault format and never contain your Master Password. Plaintext CSV export is
        intentionally not offered.
      </p>

      <h2 className="mt-8 text-xs uppercase tracking-widest text-[#AEB4BE]">Privacy & platform</h2>
      <Link to="/privacy" className="flex items-center gap-3 border-b border-white/5 py-4 text-sm text-white">
        <span className="flex-1">Privacy & local data</span><ChevronRight className="h-4 w-4 text-[#AEB4BE]" />
      </Link>
      <Link to="/native" className="flex items-center gap-3 border-b border-white/5 py-4 text-sm text-white">
        <span className="flex-1">Android autofill & native security layer</span><ChevronRight className="h-4 w-4 text-[#AEB4BE]" />
      </Link>

      <button type="button" onClick={lock} className="mt-8 w-full rounded-xl border border-white/10 py-3.5 text-sm text-white active:scale-[0.98]">
        Lock PasKey now
      </button>

      <p className="mt-8 text-center text-[11px] text-[#AEB4BE]/60">PasKey · version 1.0.0 · local-first vault</p>
    </div>
  );
}