import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CATEGORIES } from '@/lib/categories';
import CategoryIcon from './CategoryIcon';
import { useI18n } from '@/lib/i18n';

const SEMICIRCLE_POSITIONS = [
  { x: -132, y: -12 },
  { x: -114, y: -72 },
  { x: -70, y: -116 },
  { x: 0, y: -136 },
  { x: 70, y: -116 },
  { x: 114, y: -72 },
  { x: 132, y: -12 },
];

export default function AddMenu() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    const bodyOverflow = document.body.style.overflow;
    const bodyTouchAction = document.body.style.touchAction;
    const htmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.documentElement.style.overflow = 'hidden';

    const preventScroll = (event) => {
      if (!event.target.closest?.('.pk-add-menu-interactive')) {
        event.preventDefault();
      }
    };

    document.addEventListener('touchmove', preventScroll, { passive: false });

    return () => {
      document.removeEventListener('touchmove', preventScroll);
      document.body.style.overflow = bodyOverflow;
      document.body.style.touchAction = bodyTouchAction;
      document.documentElement.style.overflow = htmlOverflow;
    };
  }, [open]);

  const close = () => setOpen(false);

  const chooseCategory = (event, category) => {
    event.stopPropagation();
    close();
    navigate(`/new/${category.key}`);
  };

  const overlay = typeof document === 'undefined' ? null : createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] overscroll-none bg-[rgba(3,3,1,0.80)]"
          onClick={close}
        >
          <div
            role="group"
            aria-label={t('Add item categories')}
            className="pk-add-semicircle pk-add-menu-interactive fixed left-1/2 z-[70] h-[11rem] w-[20rem] -translate-x-1/2 select-none"
            onClick={(event) => event.stopPropagation()}
          >
            {CATEGORIES.map((category, index) => {
              const position = SEMICIRCLE_POSITIONS[index] || { x: 0, y: -136 };
              return (
                <motion.button
                  key={category.key}
                  type="button"
                  aria-label={t(category.label)}
                  onClick={(event) => chooseCategory(event, category)}
                  initial={{ opacity: 0, scale: 0.55, x: 0, y: 0 }}
                  animate={{ opacity: 1, scale: 1, x: position.x, y: position.y }}
                  exit={{ opacity: 0, scale: 0.55, x: 0, y: 0 }}
                  transition={{
                    type: 'tween',
                    duration: 0.13,
                    ease: [0.2, 0, 0, 1],
                    delay: index * 0.01,
                  }}
                  whileTap={{ scale: 0.88 }}
                  className="pk-add-menu-interactive absolute bottom-0 left-1/2 flex h-14 w-14 -ml-7 items-center justify-center rounded-full border border-white/15 bg-[#070707]/96 text-[#C8A96B] shadow-lg shadow-black/45 touch-manipulation"
                >
                  <CategoryIcon name={category.icon} className="h-5 w-5" color="#FF4365" />
                </motion.button>
              );
            })}
          </div>

          <motion.button
            type="button"
            aria-label={t('Close add menu')}
            onClick={(event) => {
              event.stopPropagation();
              close();
            }}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
            className="pk-add-menu-interactive pk-add-close-center fixed left-1/2 z-[70] inline-flex h-11 -translate-x-1/2 items-center justify-center gap-2 rounded-full border border-white/15 bg-[#070707]/96 px-5 text-sm font-medium text-white shadow-lg shadow-black/45 touch-manipulation active:scale-95"
          >
            <X className="h-5 w-5" />
            <span>{t('Close')}</span>
          </motion.button>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={t('Add item')}
        aria-expanded={open}
        className="relative z-30 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#C8A96B] px-4 text-sm font-medium text-[#070707] shadow-lg shadow-black/40 transition-transform active:scale-95"
      >
        <Plus className="h-5 w-5" />
        <span>{t('Add')}</span>
      </button>
      {overlay}
    </div>
  );
}
