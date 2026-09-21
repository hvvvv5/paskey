import React from 'react';
import { Cpu } from 'lucide-react';

export default function NativeNotice({ children }) {
  return (
    <div className="flex gap-3 rounded-xl border border-[#C8A96B]/25 bg-[#C8A96B]/5 p-4">
      <Cpu className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#C8A96B' }} aria-hidden="true" />
      <p className="text-xs leading-relaxed text-[#AEB4BE]">
        <span className="font-medium text-white">Native Android requirement. </span>
        {children}
      </p>
    </div>
  );
}