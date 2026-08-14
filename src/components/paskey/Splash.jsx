import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Logo from './Logo';

export default function Splash({ onDone }) {
  const [shimmer, setShimmer] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => setShimmer(true), 320);
    const b = setTimeout(() => onDone?.(), 1400);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#000000]">
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <Logo size={96} shimmer={shimmer} />
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="mt-6 font-heading tracking-[0.42em] text-sm text-white"
      >
        PASKEY
      </motion.p>
    </div>
  );
}