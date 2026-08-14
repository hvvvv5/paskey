import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Lock, Search } from 'lucide-react';
import { VaultProvider, useVault } from './VaultContext';
import { motion, AnimatePresence } from 'framer-motion';
import BottomNav from './BottomNav';
import Logo from './Logo';
import Splash from './Splash';
import UnlockScreen from './UnlockScreen';
import MasterPasswordSetup from './MasterPasswordSetup';

function Header() {
  const { lock } = useVault();
  const navigate = useNavigate();
  return (
    <header
      className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/10 bg-[#070707]/95 px-5 pb-4 backdrop-blur"
      style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
    >
      <Logo size={28} />
      <span className="pk-no-select font-heading text-sm tracking-[0.34em] text-white">PASKEY</span>
      <div className="ml-auto flex items-center gap-1">
        <button type="button" aria-label="Search vault" onClick={() => navigate('/?focus=search')} className="rounded-lg p-2 text-[#AEB4BE] hover:text-white active:scale-95">
          <Search className="h-5 w-5" strokeWidth={1.6} />
        </button>
        <button type="button" aria-label="Lock vault" onClick={lock} className="rounded-lg p-2 text-[#AEB4BE] hover:text-white active:scale-95">
          <Lock className="h-5 w-5" strokeWidth={1.6} />
        </button>
      </div>
    </header>
  );
}

function Gate() {
  const { hasVault, unlocked } = useVault();
  const location = useLocation();
  if (!hasVault) return <MasterPasswordSetup />;
  if (!unlocked) return <UnlockScreen />;
  return (
    <>
      <Header />
      <main className="mx-auto max-w-xl">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav />
    </>
  );
}

export default function AppShell() {
  const [splash, setSplash] = useState(true);
  return (
    <VaultProvider>
      <div className="min-h-screen bg-[#070707] text-white">
        {splash ? <Splash onDone={() => setSplash(false)} /> : <Gate />}
      </div>
    </VaultProvider>
  );
}