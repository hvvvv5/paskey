import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, Fingerprint, Timer } from 'lucide-react';
import { listAll } from '@/lib/vaultData';
import { scorePassword } from '@/lib/password';
import { useVault } from '@/components/paskey/VaultContext';
import { getCategory } from '@/lib/categories';
import NativeNotice from '@/components/paskey/NativeNotice';

export default function Security() {
  const { dec, settings } = useVault();
  const [audit, setAudit] = useState(null);

  useEffect(() => {
    (async () => {
      const items = await listAll();
      const withPw = [];
      for (const i of items) {
        if (!i.password) continue;
        withPw.push({ item: i, value: await dec(i.password) });
      }
      const weak = withPw.filter((r) => scorePassword(r.value).score < 55);
      const seen = {};
      withPw.forEach((r) => { if (r.value) seen[r.value] = (seen[r.value] || 0) + 1; });
      const reused = withPw.filter((r) => r.value && seen[r.value] > 1);
      const missing = items.filter((i) => {
        const cat = getCategory(i._category);
        return cat.fields.some((f) => f.name === 'password') && !i.password;
      });
      const old = items.filter((i) => {
        const d = new Date(i.updated_date || i.created_date);
        return Date.now() - d.getTime() > 365 * 24 * 3600 * 1000;
      });
      let score = 100;
      score -= weak.length * 8;
      score -= reused.length * 6;
      score -= missing.length * 4;
      score -= old.length * 2;
      if (!settings.biometricUnlock) score -= 5;
      if (settings.autoLockMinutes === -1) score -= 8;
      setAudit({ total: items.length, weak, reused, missing, old, score: Math.max(0, Math.min(100, score)) });
    })();
  }, [dec, settings]);

  if (!audit) return <p className="p-6 text-sm text-[#AEB4BE]">Running local analysis…</p>;

  const checks = [
    { label: 'Weak passwords', count: audit.weak.length, Icon: AlertTriangle },
    { label: 'Reused passwords', count: audit.reused.length, Icon: Copy },
    { label: 'Items missing a password', count: audit.missing.length, Icon: AlertTriangle },
    { label: 'Not updated in over a year', count: audit.old.length, Icon: Timer },
  ];

  return (
    <div className="px-5 pb-28 pt-6">
      <h1 className="font-heading text-2xl text-white">Security Center</h1>
      <p className="mt-1 text-sm text-[#AEB4BE]">Analysis runs entirely on this device. Nothing is uploaded.</p>

      <div className="mt-6 rounded-2xl border border-[#C8A96B]/25 bg-gradient-to-br from-white/[0.06] to-transparent p-6 text-center">
        <p className="text-xs uppercase tracking-widest text-[#AEB4BE]">Security Score</p>
        <p className="mt-2 font-heading text-5xl text-white">{audit.score}<span className="text-lg text-[#AEB4BE]"> / 100</span></p>
        <p className="mt-2 text-xs text-[#AEB4BE]">{audit.total} items audited</p>
      </div>

      <div className="mt-6 space-y-2">
        {checks.map(({ label, count, Icon }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3.5">
            {count === 0
              ? <CheckCircle2 className="h-4 w-4" style={{ color: '#C8A96B' }} aria-hidden="true" />
              : <Icon className="h-4 w-4 text-[#AEB4BE]" aria-hidden="true" />}
            <span className="flex-1 text-sm text-white">{label}</span>
            <span className="text-sm text-[#AEB4BE]">{count === 0 ? 'None' : count}</span>
          </div>
        ))}
        <div className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3.5">
          <Fingerprint className="h-4 w-4 text-[#AEB4BE]" aria-hidden="true" />
          <span className="flex-1 text-sm text-white">Biometric unlock</span>
          <span className="text-sm text-[#AEB4BE]">{settings.biometricUnlock ? 'Enabled' : 'Off'}</span>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3.5">
          <Timer className="h-4 w-4 text-[#AEB4BE]" aria-hidden="true" />
          <span className="flex-1 text-sm text-white">Auto-lock</span>
          <span className="text-sm text-[#AEB4BE]">
            {settings.autoLockMinutes === -1 ? 'Never' : settings.autoLockMinutes === 0 ? 'Immediately' : `${settings.autoLockMinutes} min`}
          </span>
        </div>
      </div>

      <div className="mt-6">
        <NativeNotice>
          Biometric status is read from BiometricManager and background locking is driven by the Android activity
          lifecycle in the production build; this layer reflects your saved preference only.
        </NativeNotice>
      </div>
    </div>
  );
}