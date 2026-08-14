import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Lock, Search } from 'lucide-react';
import { VaultProvider, useVault } from './VaultContext';
import BottomNav from './BottomNav';
import Logo from './Logo';
import Splash from './Splash';
import UnlockScreen from './UnlockScreen';
import MasterPasswordSetup from './MasterPasswordSetup';

function Header() {
  const { lock } = useVault();
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/10 bg-[#070707]/95 px-5 py-4 backdrop-blur">
      <Logo size={28} />
      <span className="font-heading text-sm tracking-[0.34em] text-white">PASKEY</span>
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
  if (!hasVault) return <MasterPasswordSetup />;
  if (!unlocked) return <UnlockScreen />;
  return (
    <>
      <Header />
      <main className="mx-auto max-w-xl"><Outlet /></main>
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