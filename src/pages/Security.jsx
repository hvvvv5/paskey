import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, Fingerprint, Timer } from 'lucide-react';
import { useVault } from '@/components/paskey/VaultContext';
import NativeNotice from '@/components/paskey/NativeNotice';
import { useI18n } from '@/lib/i18n';

export default function Security() {
  const { t } = useI18n();
  const { repo, settings } = useVault();
  const [audit, setAudit] = useState(null);

  useEffect(() => { repo.getSecurityStatistics(settings).then(setAudit); }, [repo, settings]);

  if (!audit) return <p className="p-6 text-sm text-[#AEB4BE]">{t('Running local analysis…')}</p>;

  const checks = [
    { label: 'Weak passwords', count: audit.weak.length, Icon: AlertTriangle },
    { label: 'Reused passwords', count: audit.reused.length, Icon: Copy },
    { label: 'Items missing a password', count: audit.missing.length, Icon: AlertTriangle },
    { label: 'Not updated in over a year', count: audit.old.length, Icon: Timer },
  ];

  return (
    <div className="px-5 pb-32 pt-6">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-[#C8A96B]">{t('Local protection')}</p>
        <h1 className="mt-1 font-heading text-2xl text-white">{t('Security Center')}</h1>
      </div>
      <p className="mt-1 text-sm text-[#AEB4BE]">{t('Analysis runs entirely on this device. Nothing is uploaded.')}</p>

      <div className="mt-6 rounded-2xl border border-[#C8A96B]/25 bg-gradient-to-br from-white/[0.06] to-transparent p-6 text-center">
        <p className="text-xs uppercase tracking-widest text-[#AEB4BE]">{t('Security Score')}</p>
        <p className="mt-2 font-heading text-5xl text-white">{audit.score}<span className="text-lg text-[#AEB4BE]"> / 100</span></p>
        <p className="mt-2 text-xs text-[#AEB4BE]">{audit.total} items audited</p>
      </div>

      <div className="mt-6 space-y-2">
        {checks.map(({ label, count, Icon }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3.5">
            {count === 0
              ? <CheckCircle2 className="h-4 w-4" style={{ color: '#C8A96B' }} aria-hidden="true" />
              : <Icon className="h-4 w-4 text-[#AEB4BE]" aria-hidden="true" />}
            <span className="flex-1 text-sm text-white">{t(label)}</span>
            <span className="text-sm text-[#AEB4BE]">{count === 0 ? t('None') : count}</span>
          </div>
        ))}
        <div className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3.5">
          <Fingerprint className="h-4 w-4 text-[#AEB4BE]" aria-hidden="true" />
          <span className="flex-1 text-sm text-white">{t('Biometric unlock')}</span>
          <span className="text-sm text-[#AEB4BE]">{settings.biometricUnlock ? t('Enabled') : t('Off')}</span>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3.5">
          <Timer className="h-4 w-4 text-[#AEB4BE]" aria-hidden="true" />
          <span className="flex-1 text-sm text-white">Auto-lock</span>
          <span className="text-sm text-[#AEB4BE]">
            {settings.autoLockMinutes === -1 ? 'Never' : settings.autoLockMinutes === 0 ? 'Immediately' : `${settings.autoLockMinutes} min`}
          </span>
        </div>
      </div>

      <div className="pk-security-native-notice mt-6">
        <NativeNotice>
          Biometric status is read from BiometricManager and background locking is driven by the Android activity
          lifecycle in the production build; this layer reflects your saved preference only.
        </NativeNotice>
      </div>
    </div>
  );
}
