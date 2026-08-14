import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CATEGORIES } from '@/lib/categories';
import CategoryIcon from './CategoryIcon';

export default function AddMenu() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-24 left-1/2 w-[88%] max-w-sm -translate-x-1/2 rounded-2xl border border-white/10 bg-[#070707] p-2"
            >
              {CATEGORIES.map((c) => (
                <Link
                  key={c.key} to={`/new/${c.key}`} onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-white hover:bg-white/5"
                >
                  <CategoryIcon name={c.icon} className="h-4 w-4" /> {c.label}
                </Link>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <button
        type="button" onClick={() => setOpen((v) => !v)} aria-label={open ? 'Close add menu' : 'Add item'}
        className="fixed bottom-20 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#C8A96B] text-black shadow-lg shadow-black/60 transition-transform active:scale-95"
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </>
  );
}