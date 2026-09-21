import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CATEGORIES } from '@/lib/categories';
import CategoryIcon from './CategoryIcon';

const ARC_POSITIONS = [
  { x: 220, y: 264, scale: 0.84 },
  { x: 164, y: 224, scale: 0.92 },
  { x: 112, y: 168, scale: 1 },
  { x: 78, y: 102, scale: 0.94 },
  { x: 68, y: 34, scale: 0.86 },
];
const DRAG_STEP = 38;
const mod = (value, length) => ((value % length) + length) % length;

export default function AddMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [wheelIndex, setWheelIndex] = useState(0);
  const dragRef = useRef(null);
  const suppressClickUntilRef = useRef(0);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const close = () => {
    dragRef.current = null;
    setOpen(false);
  };

  const startDrag = (event) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      step: 0,
      moved: false,
    };
  };

  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 7) drag.moved = true;
    const distance = Math.abs(dy) >= Math.abs(dx) ? -dy : -dx;
    const nextStep = Math.trunc(distance / DRAG_STEP);
    if (nextStep === drag.step) return;

    const change = nextStep - drag.step;
    drag.step = nextStep;
    setWheelIndex((current) => mod(current + change, CATEGORIES.length));
  };

  const endDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    if (drag.moved) suppressClickUntilRef.current = Date.now() + 250;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  const chooseCategory = (event, category) => {
    event.stopPropagation();
    if (Date.now() < suppressClickUntilRef.current) return;
    close();
    navigate(`/new/${category.key}`);
  };

  const visibleCategories = ARC_POSITIONS.map((position, slot) => ({
    category: CATEGORIES[mod(wheelIndex + slot, CATEGORIES.length)],
    position,
  }));

  const overlay = typeof document === 'undefined' ? null : createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-[rgba(3,3,1,0.72)] backdrop-blur-[14px]"
          onClick={close}
        >
          <motion.div
            role="group"
            aria-label="Add item categories"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.2 }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="pk-add-wheel fixed bottom-[calc(8.75rem+env(safe-area-inset-bottom))] right-3 z-[70] h-[21rem] w-[18rem] touch-none select-none"
          >
            <AnimatePresence initial={false}>
              {visibleCategories.map(({ category, position }) => (
                <motion.button
                  key={category.key}
                  type="button"
                  aria-label={category.label}
                  onClick={(event) => chooseCategory(event, category)}
                  initial={{ opacity: 0, scale: 0.55 }}
                  animate={{
                    x: position.x,
                    y: position.y,
                    opacity: 1,
                    scale: position.scale,
                  }}
                  exit={{ opacity: 0, scale: 0.55 }}
                  transition={{ type: 'spring', stiffness: 330, damping: 29 }}
                  whileTap={{ scale: position.scale * 0.9 }}
                  className="pk-add-wheel-button absolute left-0 top-0 flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-[#070707]/95 text-[#C8A96B] shadow-xl shadow-black/55 backdrop-blur-md"
                >
                  <CategoryIcon name={category.icon} className="h-5 w-5" color="#FF4365" />
                </motion.button>
              ))}
            </AnimatePresence>
          </motion.div>

          <motion.button
            type="button"
            aria-label="Close add menu"
            onClick={(event) => {
              event.stopPropagation();
              close();
            }}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="pk-add-close fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-5 z-[70] inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/15 bg-[#070707]/95 px-5 text-sm font-medium text-white shadow-xl shadow-black/60 backdrop-blur-md active:scale-95"
          >
            <X className="h-5 w-5" />
            <span>Close</span>
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
        aria-label="Add item"
        aria-expanded={open}
        className="relative z-30 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#C8A96B] px-4 text-sm font-medium text-[#070707] shadow-lg shadow-black/40 transition-transform active:scale-95"
      >
        <Plus className="h-5 w-5" />
        <span>Add</span>
      </button>
      {overlay}
    </div>
  );
}
