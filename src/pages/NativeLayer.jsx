import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const SECTIONS = [
  {
    title: 'AutofillService (not a keyboard)',
    body: 'PasKey registers an android.service.autofill.AutofillService in the manifest with BIND_AUTOFILL_SERVICE. It parses the incoming AssistStructure, resolves the requesting package name or web domain, requires BiometricPrompt authentication, matches vault entries by applicationIdentifier / website, and returns a FillResponse containing only relevant datasets. It never registers an InputMethodService — the user keeps their own keyboard.',
  },
  {
    title: 'Save & update flows',
    body: 'SaveInfo on the FillResponse triggers Android’s onSaveRequest, which shows “Save this login to PasKey?”. When a credential already exists for that domain and the value differs, PasKey asks “Update password in PasKey?”. Nothing is written without explicit user confirmation.',
  },
  {
    title: 'Credential Manager & passkeys',
    body: 'Passkeys are handled through CredentialManager / CredentialProviderService (WebAuthn), never stored as password rows. Private keys stay in hardware-backed Keystore; the vault only records passkey metadata, and the UI labels passkeys separately from passwords.',
  },
  {
    title: 'Crypto & storage',
    body: 'Master Password → Argon2id (PBKDF2-HMAC-SHA256 fallback) with a unique random salt → vault key → AES-256-GCM with a fresh 96-bit nonce per record → Room/SQLite encrypted local storage. Key material is wrapped by the Android Keystore. Nothing is transmitted off-device.',
  },
  {
    title: 'Biometrics, lifecycle & clipboard',
    body: 'BiometricPrompt for unlock and for revealing passwords, CVV, PIN and banking data. Auto-lock on onStop, device lock and timeout. Sensitive activities set FLAG_SECURE. Copied secrets are marked sensitive (EXTRA_IS_SENSITIVE) and cleared after the configured delay. No secret is ever written to logs or crash reports.',
  },
  {
    title: 'What this layer is',
    body: 'This Base44 application layer implements the product: UI, navigation, vault model, categories, search, generator, local security audit, settings and the encryption contract. It does not and cannot implement Android AutofillService, Keystore, BiometricPrompt, Credential Manager, FLAG_SECURE or OS clipboard policy — those are wired in the native Android module for the PasKey.apk build.',
  },
];

export default function NativeLayer() {
  return (
    <div className="px-5 pb-28 pt-5">
      <div className="flex items-center gap-3">
        <Link to="/settings" aria-label="Back to settings" className="rounded-lg p-2 text-[#AEB4BE] hover:text-white"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="font-heading text-xl text-white">Native Android layer</h1>
      </div>
      <p className="mt-3 text-sm text-[#AEB4BE]">
        Integration contract for the production APK. These components must be implemented natively — they are not
        simulated here.
      </p>
      <div className="mt-6 space-y-3">
        {SECTIONS.map((s) => (
          <section key={s.title} className="rounded-2xl border border-white/10 p-5">
            <h2 className="text-sm text-white" style={{ borderLeft: '2px solid #C8A96B', paddingLeft: 10 }}>{s.title}</h2>
            <p className="mt-3 text-xs leading-relaxed text-[#AEB4BE]">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}