import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { generatePassword, scorePassword } from '@/lib/password';
import CopyButton from '@/components/paskey/CopyButton';

const TOGGLES = [
  ['uppercase', 'Uppercase (A–Z)'],
  ['lowercase', 'Lowercase (a–z)'],
  ['numbers', 'Numbers (0–9)'],
  ['symbols', 'Symbols (!@#$)'],
];

export default function Generator() {
  const [opts, setOpts] = useState({ length: 20, uppercase: true, lowercase: true, numbers: true, symbols: true });
  const [value, setValue] = useState('');
  const { label, score } = scorePassword(value);

  useEffect(() => { setValue(generatePassword(opts)); }, [opts]);

  return (
    <div className="px-5 pb-28 pt-6">
      <h1 className="font-heading text-2xl text-white">Password Generator</h1>
      <p className="mt-1 text-sm text-[#AEB4BE]">Generated locally with a cryptographically secure RNG.</p>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="break-all font-mono text-lg text-white">{value}</p>
        <p className="mt-3 text-xs uppercase tracking-widest" style={{ color: score >= 75 ? '#C8A96B' : '#AEB4BE' }}>{label}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button" onClick={() => setValue(generatePassword(opts))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-[#AEB4BE] hover:border-[#C8A96B]/50 hover:text-white active:scale-[0.97]"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Regenerate
          </button>
          <CopyButton sensitive label="Copy" getValue={() => value} />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 p-5">
        <label htmlFor="len" className="flex items-center justify-between text-sm text-white">
          Length <span className="font-mono" style={{ color: '#C8A96B' }}>{opts.length}</span>
        </label>
        <input
          id="len" type="range" min={8} max={64} value={opts.length}
          onChange={(e) => setOpts({ ...opts, length: Number(e.target.value) })}
          className="mt-3 w-full accent-[#C8A96B]"
        />
        <div className="mt-5 space-y-3">
          {TOGGLES.map(([k, lbl]) => (
            <label key={k} className="flex items-center justify-between text-sm text-[#AEB4BE]">
              {lbl}
              <input
                type="checkbox" checked={opts[k]} onChange={(e) => setOpts({ ...opts, [k]: e.target.checked })}
                className="h-5 w-5 accent-[#C8A96B]"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}