import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import CopyButton from './CopyButton';
import { useVault } from './VaultContext';

export default function SensitiveField({ label, cipher }) {
  const { dec, settings } = useVault();
  const [value, setValue] = useState(null);

  const reveal = async () => {
    if (value !== null) { setValue(null); return; }
    setValue(await dec(cipher));
  };

  if (!cipher) return null;

  return (
    <div className="border-b border-white/5 py-4">
      <p className="text-[11px] uppercase tracking-widest text-[#AEB4BE]/70">{label}</p>
      <p className="mt-1 break-all font-mono text-sm text-white">
        {value !== null ? value || '—' : '••••••••••••'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reveal}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-[#AEB4BE] transition-colors hover:border-[#C8A96B]/50 hover:text-white active:scale-[0.97]"
          aria-label={value !== null ? `Hide ${label}` : `Show ${label}`}
        >
          {value !== null ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {value !== null ? 'Hide' : 'Show'}
        </button>
        <CopyButton sensitive label="Copy" getValue={() => dec(cipher)} />
      </div>
      {settings.requireAuthToReveal && (
        <p className="mt-2 text-[10px] leading-relaxed text-[#AEB4BE]/60">
          Native build: BiometricPrompt re-authentication is required before this value is revealed.
        </p>
      )}
    </div>
  );
}