import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { VaultProvider, useVault } from './VaultContext';
import { motion } from 'framer-motion';
import BottomNav from './BottomNav';
import Logo from './Logo';
import Splash from './Splash';
import UnlockScreen from './UnlockScreen';
import MasterPasswordSetup from './MasterPasswordSetup';
import { I18nProvider } from '@/lib/i18n';


function Header() {
  return (
    <header
      className="pk-safe-header sticky top-0 z-20 flex items-center gap-3 border-b border-white/10 bg-[#070707] px-5 pb-4"
    >
      <span className="pk-logo-badge flex h-9 w-9 shrink-0 items-center justify-center rounded-full" aria-hidden="true"><Logo size={24} /></span>
      <span className="pk-no-select font-heading text-sm tracking-[0.34em] text-white">PASKEY</span>
      <div className="ml-auto" />
    </header>
  );
}

const MAIN_TABS = new Set(['/', '/autofill', '/generator', '/security', '/settings']);

const pageTransition = {
  initial: { opacity: 0.94, y: 6 },
  animate: { opacity: 1, y: 0 },
};

function Gate() {
  const { hasVault, unlocked } = useVault();
  const location = useLocation();

  if (!hasVault) return <MasterPasswordSetup />;
  if (!unlocked) return <UnlockScreen />;

  const showChrome = MAIN_TABS.has(location.pathname);

  return (
    <>
      {showChrome && <Header />}
      <main className="relative mx-auto max-w-xl overflow-hidden">
        <motion.div
          key={location.pathname}
          className="w-full"
          initial="initial"
          animate="animate"
          variants={pageTransition}
          transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }}
        >
          <Outlet />
        </motion.div>
      </main>
      {showChrome && <BottomNav />}
    </>
  );
}

export default function AppShell() {
  const [splash, setSplash] = useState(true);
  return (
    <VaultProvider>
      <I18nProvider>
      <div className="min-h-screen bg-[#070707] text-white">
        {splash ? <Splash onDone={() => setSplash(false)} /> : <Gate />}
      </div>
      </I18nProvider>
    </VaultProvider>
  );
}
