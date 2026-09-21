import React, { useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export default function PullToRefresh({ onRefresh, children }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const pulling = useRef(false);
  const THRESHOLD = 70;

  const onTouchStart = (e) => {
    if (window.scrollY > 0 || refreshing) { startY.current = null; pulling.current = false; return; }
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  };
  const onTouchMove = (e) => {
    if (!pulling.current || startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setPull(Math.min(dy * 0.5, 100));
  };
  const onTouchEnd = async () => {
    if (!pulling.current) return;
    pulling.current = false;
    startY.current = null;
    if (pull >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPull(THRESHOLD);
      try { await onRefresh?.(); } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else if (!refreshing) {
      setPull(0);
    }
  };

  const rotate = Math.min(pull / THRESHOLD, 1) * 180;
  const show = pull > 0 || refreshing;

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} className="relative">
      <div
        className="pointer-events-none absolute left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center"
        style={{ top: pull - 40, opacity: show ? 1 : 0, transition: pulling.current ? 'none' : 'opacity 0.2s' }}
        aria-hidden="true"
      >
        <RefreshCw
          className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`}
          style={{ color: '#C8A96B', transform: `rotate(${rotate}deg)` }}
        />
      </div>
      <div
        style={{
          transform: pull === 0 ? 'none' : `translateY(${pull}px)`,
          transition: pulling.current ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}