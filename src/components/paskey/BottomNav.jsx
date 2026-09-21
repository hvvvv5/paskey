import React from 'react';
import { NavLink } from 'react-router-dom';
import { Shield, KeyRound, Wand2, ShieldCheck, Settings as SettingsIcon } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const ITEMS = [
  { to: '/', label: 'Vault', Icon: Shield },
  { to: '/autofill', label: 'Autofill', Icon: KeyRound },
  { to: '/generator', label: 'Generator', Icon: Wand2 },
  { to: '/security', label: 'Security', Icon: ShieldCheck },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
];

export default function BottomNav() {
  const { t } = useI18n();
  return (
    <nav
      aria-label={t("Main navigation")}
      className="pk-no-select fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#070707]/95 shadow-[0_-12px_32px_rgba(0,0,0,0.35)] backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto grid h-[4.5rem] max-w-xl grid-cols-5">
        {ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className="flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10px] tracking-wide transition-colors sm:text-[11px]"
          >
            {({ isActive }) => (
              <>
                <Icon
                  className="h-5 w-5"
                  strokeWidth={1.6}
                  style={{ color: isActive ? 'var(--pk-accent)' : 'var(--pk-muted)' }}
                  aria-hidden="true"
                />
                <span style={{ color: isActive ? 'var(--pk-accent)' : 'var(--pk-muted)' }}>
                  {t(label)}
                  {isActive ? <span className="sr-only"> (current)</span> : null}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
