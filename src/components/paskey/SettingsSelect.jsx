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
        <SelectTrigger aria-label={ariaLabel} className={triggerClass}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border-white/10 bg-[#070707] text-white">
          {options.map(([v, l]) => (
            <SelectItem key={v} value={String(v)}>{l}</SelectItem>
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
          className={`flex h-9 items-center justify-between border px-3 text-sm text-[#AEB4BE] ${triggerClass}`}
        >
          <span className="truncate">{currentLabel}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
      </DrawerTrigger>
      <DrawerContent className="border-white/10 bg-[#070707] text-white">
        <div className="px-4 pb-8 pt-2">
          <DrawerTitle className="pb-2 text-center text-xs font-normal uppercase tracking-widest text-[#AEB4BE]">{ariaLabel}</DrawerTitle>
          {options.map(([v, l]) => {
            const active = String(v) === String(value);
            return (
              <button
                key={v}
                type="button"
                onClick={() => { onValueChange(Number(v)); setOpen(false); }}
                className="flex w-full items-center justify-between border-b border-white/5 py-4 text-left text-sm text-white active:bg-white/5"
              >
                <span>{l}</span>
                {active && <Check className="h-4 w-4" style={{ color: '#C8A96B' }} />}
              </button>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
  );
}