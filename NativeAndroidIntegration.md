# PasKey — Native Android Integration Contract

This document defines the native Android components required to turn the PasKey
web/prototype foundation into the production `PasKey.apk`. The React codebase in
this repository implements the product UI, vault model, categories, search,
password generator, local security audit, settings and the encryption contract.
It does **NOT** implement any Android-system security component. Each section
below is labelled accordingly.

Status legend:
- **IMPLEMENTED IN WEB PROTOTYPE** — provided by this React codebase as a
  development stand-in. It is not production-secure and must be replaced.
- **REQUIRES NATIVE ANDROID IMPLEMENTATION** — must be built in Android Studio.
  The web layer only defines the data model / UI contract for it.

---

## 1. Master Password architecture
**IMPLEMENTED IN WEB PROTOTYPE** (contract) + **REQUIRES NATIVE ANDROID IMPLEMENTATION** (key storage).
- Flow: `Master Password → strong KDF → encryption key (KEK) → wrapped vault data key K → encrypted vault`.
- The data key `K` is a random AES-256 key, independent of the Master Password.
- Changing the Master Password only **re-wraps** `K` (a new KEK wraps the same `K`); vault data is never re-encrypted and the old Master Password is never recoverable.
- The Master Password is never stored, logged, displayed, or transmitted.
- Web prototype: PBKDF2-HMAC-SHA256, 310k iterations, 16-byte random salt (see `src/lib/crypto.js`).
- Native: derive the KEK with **Argon2id** (PBKDF2 fallback), store the wrapped `K` and salt in Keystore-backed encrypted storage. Never hold the raw Master Password or raw `K` in memory longer than necessary.

## 2. Keystore architecture
**REQUIRES NATIVE ANDROID IMPLEMENTATION.**
- The Android Keystore must generate and store the KEK / data key material inside hardware-backed KeyStore (StrongBox where available).
- The web prototype keeps the wrapped key in `localStorage` — this is **not** secure production storage and must be replaced.
- BiometricPrompt must gate access to the Keystore-protected key.

## 3. BiometricPrompt integration
**REQUIRES NATIVE ANDROID IMPLEMENTATION.**
- Use `androidx.biometric.BiometricPrompt` for unlock and for revealing sensitive fields (passwords, CVV, PIN, banking data).
- Support fingerprint and face authentication where the device provides them.
- PasKey never stores biometric data — Android owns it. Biometrics only authorize access to protected vault keys.
- The web prototype only stores the `biometricUnlock` preference; it does not and cannot run BiometricPrompt.

## 4. Room / SQLCipher storage
**REQUIRES NATIVE ANDROID IMPLEMENTATION.**
- Replace `src/lib/repository/vaultRepository.js` with a native repository backed by Room/SQLite encrypted with SQLCipher (or Jetpack Security `EncryptedFile`/`EncryptedSharedPreferences` for small config).
- Preserve the entity model: `VaultItem`, `BankAccount`, `Card`, `Address`, `SecureNote`.
- Sensitive fields stay AES-256-GCM ciphertext at rest; metadata (title, website, username, email, category, favorite, timestamps) stays plaintext and searchable.
- The repository interface (`createItem`, `getItem`, `updateItem`, `deleteItem`, `listItems`, `searchItems`, `toggleFavorite`, `markUsed`, `getSecurityStatistics`) is the swap point — the UI requires no changes.

## 5. AutofillService
**REQUIRES NATIVE ANDROID IMPLEMENTATION.** (Not a keyboard.)
- Register `android.service.autofill.AutofillService` with `BIND_AUTOFILL_SERVICE`. PasKey does **not** register an `InputMethodService` — the user keeps their own keyboard.
- Parse the incoming `AssistStructure`, resolve the requesting package name or web domain, require BiometricPrompt authentication, match vault entries by `applicationIdentifier` / `website`, and return a `FillResponse` with only relevant datasets.
- `SaveInfo` triggers `onSaveRequest` ("Save this login to PasKey?") and update flows ("Update password in PasKey?"). Nothing is written without explicit user confirmation.
- The web layer never simulates Autofill.

## 6. Credential Manager
**REQUIRES NATIVE ANDROID IMPLEMENTATION.**
- Integrate `androidx.credentials` / `CredentialManager` for sign-in flows surfaced by other apps.
- Passkeys are handled via `CredentialProviderService` (WebAuthn); private keys stay in hardware-backed Keystore. The vault only records passkey metadata; the UI labels passkeys separately from passwords.

## 7. Passkeys (WebAuthn)
**REQUIRES NATIVE ANDROID IMPLEMENTATION.**
- Implement `CredentialProviderService` for passkey creation and assertion.
- Never store passkey private keys as password rows. The `VaultItem` field `credentialKind` ("password" | "passkey") distinguishes them.

## 8. Auto-lock
**IMPLEMENTED IN WEB PROTOTYPE** (timeout + visibility) + **REQUIRES NATIVE ANDROID IMPLEMENTATION** (lifecycle).
- Options: Immediately, 1 min, 5 min (default), 15 min, 30 min, Never.
- Native must lock when: the activity goes to background (`onStop`), the device is locked, or the timeout expires. The web layer applies only the in-app timeout and `visibilitychange`; it must not claim OS-level security.

## 9. FLAG_SECURE
**REQUIRES NATIVE ANDROID IMPLEMENTATION.**
- Set `FLAG_SECURE` on every activity that displays vault data (vault, item detail/edit, generator, security center) to block screenshots and screen recording.
- The web layer only documents the intent; it cannot set `FLAG_SECURE`.

## 10. Clipboard protection
**REQUIRES NATIVE ANDROID IMPLEMENTATION.**
- Copied secrets must be marked sensitive (`ClipDescription.EXTRA_IS_SENSITIVE`) on Android 13+ and cleared after the configured delay.
- The web prototype does a best-effort `navigator.clipboard` clear; OS-level protection is native-only.

## 11. Backup / restore
**IMPLEMENTED IN WEB PROTOTYPE** + **REQUIRES NATIVE ANDROID IMPLEMENTATION** (native store).
- Backup exports AES-256-GCM ciphertext only — never plaintext secrets, never the Master Password. Plaintext CSV export is intentionally not offered.
- Restore validates the backup's `kekSalt` against the current vault before importing.
- Native: back up to an encrypted on-device file (or user-chosen location); never auto-upload. If plaintext export is ever added, require a strong warning, explicit confirmation, a temporary file only, and never auto-upload.

## 12. APK build requirements
- `appId: com.paskey.vault` (do not change), `appName: PasKey`, `webDir: dist` — see `capacitor.config.ts`.
- `npm install && npm run build` produces the `dist/` consumed by Capacitor.
- Add the Android platform: `npx cap add android`, then `npx cap sync` after each `npm run build`.
- Enable R8/ProGuard minification, set `android:allowBackup="false"` (or back up only non-sensitive config), enable Network Security Config, target a current API level, and sign releases with a production keystore.

## 13. Release security checklist
- Keystore is hardware-backed; raw Master Password and raw `K` never persist.
- `FLAG_SECURE` on all sensitive activities.
- AutofillService + CredentialProviderService registered and permission-protected.
- BiometricPrompt gates unlock and reveal.
- No sensitive data in logs, crash reports, or analytics.
- Backup files encrypted; no plaintext export by default.
- `allowBackup` disabled for vault data; `debuggable` false in release.
- Obfuscation/minification enabled; dependencies audited; no ad/analytics SDK receives vault contents.
- Penetration test of the autofill and storage layers before release.

---

## Components that are NOT implemented here (do not simulate)
Android AutofillService · BiometricPrompt · Android Keystore · Credential Manager ·
CredentialProviderService · Passkeys · FLAG_SECURE · native clipboard protection ·
Room/SQLite encrypted storage. The React layer defines only the data model and UI
contract for each of these; it never fakes their behavior.