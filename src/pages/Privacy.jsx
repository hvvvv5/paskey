import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

const POINTS = [
  'No account required.',
  'Your vault stays on your device.',
  'Your passwords are encrypted.',
  'PasKey does not sell your data.',
  'PasKey does not use your passwords for analytics.',
  'PasKey does not require internet access for normal vault usage.',
];

export default function Privacy() {
  const navigate = useNavigate();
  return (
    <div className="px-5 pb-28 pt-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="rounded-lg p-2 text-[#AEB4BE] hover:text-white active:scale-95">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-heading text-2xl text-white">Privacy</h1>
      </div>
      <p className="mt-1 text-sm text-[#AEB4BE]">Local-first by design.</p>
      <ul className="mt-6 space-y-3">
        {POINTS.map((p) => (
          <li key={p} className="flex gap-3 rounded-xl border border-white/10 p-4 text-sm text-white">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#C8A96B' }} aria-hidden="true" />
            {p}
          </li>
        ))}
      </ul>
      <div className="mt-6 rounded-xl border border-white/10 p-4 text-xs leading-relaxed text-[#AEB4BE]">
        In this application layer, your Master Password never leaves the device: the vault key is derived in the browser
        with PBKDF2-HMAC-SHA256 and a unique random salt, and sensitive fields are sealed with AES-256-GCM before they
        are stored. The Master Password itself is never stored, displayed, transmitted, or logged. In the production
        Android build, key material is additionally protected by the Android Keystore and the vault is stored in
        encrypted local storage.
      </div>
    </div>
  );
}