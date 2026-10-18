import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useVault } from './VaultContext';
import { PasKeySecurity } from '@/lib/native/PasKeySecurity';
import { useI18n } from '@/lib/i18n';



export default function CopyButton({ getValue, label = 'Copy', sensitive = false, primary = false }) {
  const { settings } = useVault();
  const { t } = useI18n();
  const [done, setDone] = useState(false);

  const copy = async () => {
    const value = await getValue();
    if (!value) return;

   const clearSeconds = sensitive
      ? Number(settings.clipboardClearSeconds || 0)
      : 0;

    let copied = false;

    if (Capacitor.getPlatform() === 'android') {
      try {
        await PasKeySecurity.copySecure({
          value,
          seconds: clearSeconds,
        });
        copied = true;
      } catch {
        // Fall back silently; clipboard errors must never expose secret data
        // through browser or native logs.
      }
    }

    if (!copied) {
      await navigator.clipboard.writeText(value);

      if (clearSeconds > 0) {
        setTimeout(async () => {
          try {
            const current = await navigator.clipboard.readText();
            if (current === value) {
              await navigator.clipboard.writeText('');
            }
          } catch {
            // Browser may block clipboard read.
          }
        }, clearSeconds * 1000);
      }
    }

    setDone(true);
    setTimeout(() => setDone(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={copy}
     aria-label={t(label)}
      className={primary
        ? 'inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#C8A96B] px-4 py-3 text-sm font-medium text-[#070707] transition-transform active:scale-[0.97]'
        : 'inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-[#AEB4BE] transition-colors hover:border-[#C8A96B]/50 hover:text-white active:scale-[0.97]'}
    >
      {done ? (
        <Check className="h-3.5 w-3.5" style={{ color: '#C8A96B' }} />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {done ? t('Copied') : t(label)}
    </button>
  );
}
