import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useVault } from './VaultContext';

export default function CopyButton({ getValue, label = 'Copy', sensitive = false }) {
  const { settings } = useVault();
  const [done, setDone] = useState(false);

  const copy = async () => {
    const value = await getValue();
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setDone(true);
    setTimeout(() => setDone(false), 1600);
    if (sensitive && settings.clipboardClearSeconds > 0) {
      setTimeout(async () => {
        try {
          const current = await navigator.clipboard.readText();
          if (current === value) await navigator.clipboard.writeText('');
        } catch {
          /* clipboard read may be blocked; native layer handles secure clearing */
        }
      }, settings.clipboardClearSeconds * 1000);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-[#AEB4BE] transition-colors hover:border-[#C8A96B]/50 hover:text-white active:scale-[0.97]"
    >
      {done ? <Check className="h-3.5 w-3.5" style={{ color: '#C8A96B' }} /> : <Copy className="h-3.5 w-3.5" />}
      {done ? 'Copied' : label}
    </button>
  );
}