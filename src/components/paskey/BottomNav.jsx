import React from 'react';
import { NavLink } from 'react-router-dom';
import { Shield, Wand2, ShieldCheck, Settings as SettingsIcon } from 'lucide-react';

const ITEMS = [
  { to: '/', label: 'Vault', Icon: Shield },
  { to: '/generator', label: 'Generator', Icon: Wand2 },
  { to: '/security', label: 'Security', Icon: ShieldCheck },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
];

export default function BottomNav() {
  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-[#070707]/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-xl">
        {ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className="flex flex-1 flex-col items-center gap-1 py-3 text-[11px] tracking-wide transition-colors"
          >
            {({ isActive }) => (
              <>
                <Icon
                  className="h-5 w-5"
                  strokeWidth={1.6}
                  style={{ color: isActive ? '#C8A96B' : '#AEB4BE' }}
                  aria-hidden="true"
                />
                <span style={{ color: isActive ? '#C8A96B' : '#AEB4BE' }}>
                  {label}
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