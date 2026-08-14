import React, { useEffect, useRef, useState } from 'react';
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

const MAIN_TABS = new Set(['/', '/generator', '/security', '/settings']);

// iOS-style push (dir >= 0): new screen enters from the right, old exits left.
// pop (dir < 0): new screen enters from the left, old exits right.
const pageVariants = {
  enter: (dir) => ({ x: dir >= 0 ? '100%' : '-28%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir >= 0 ? '-28%' : '100%', opacity: 0 }),
};

function Gate() {
  const { hasVault, unlocked } = useVault();
  const location = useLocation();
  const stackRef = useRef([location.pathname]);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    const stack = stackRef.current;
    const next = location.pathname;
    if (stack.length >= 2 && stack[stack.length - 2] === next) {
      stack.pop();
      setDirection(-1);
    } else if (stack[stack.length - 1] !== next) {
      stack.push(next);
      setDirection(1);
    }
  }, [location.pathname]);

  if (!hasVault) return <MasterPasswordSetup />;
  if (!unlocked) return <UnlockScreen />;

  const showChrome = MAIN_TABS.has(location.pathname);

  return (
    <>
      {showChrome && <Header />}
      <main className="relative mx-auto max-w-xl overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={location.pathname}
            className="w-full"
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'tween', ease: [0.32, 0.72, 0, 1], duration: 0.34 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      {showChrome && <BottomNav />}
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