// The Radix/Vaul wrappers expose polymorphic components whose runtime props
// are intentionally broader than their generated JS declarations.
// @ts-nocheck
import React, { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';

// Native-like selector: a vaul bottom sheet on mobile, the Radix Select popover on desktop.
export default function SettingsSelect({ ariaLabel, value, onValueChange, options, triggerClass = '' }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const currentLabel = options.find((o) => String(o[0]) === String(value))?.[1] ?? '';

  if (!isMobile) {
    return (
      <Select value={String(value)} onValueChange={(v) => onValueChange(Number(v))}>
        <SelectTrigger aria-label={ariaLabel} className={`pk-settings-select-trigger ${triggerClass}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="pk-settings-select-popover">
          {options.map(([v, l]) => (
            <SelectItem key={v} value={String(v)} className="pk-settings-select-item">{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={`pk-settings-select-trigger flex h-10 items-center justify-between border px-3 text-sm ${triggerClass}`}
        >
          <span className="truncate">{currentLabel}</span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </button>
      </DrawerTrigger>
      <DrawerContent className="pk-settings-sheet">
        <div className="px-4 pb-8 pt-2">
          <DrawerTitle className="pk-settings-sheet-title pb-3 text-center text-xs font-normal uppercase tracking-widest">{ariaLabel}</DrawerTitle>
          <div className="overflow-hidden rounded-2xl border pk-settings-options">
            {options.map(([v, l]) => {
              const active = String(v) === String(value);
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => { onValueChange(Number(v)); setOpen(false); }}
                  className={`pk-settings-option flex w-full items-center justify-between px-4 py-4 text-sm ${active ? 'is-active' : ''}`}
                >
                  <span>{l}</span>
                  {active && <Check className="h-4 w-4 pk-settings-check" />}
                </button>
              );
            })}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
