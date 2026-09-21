# PasKey — Base44 Migration Report

Goal: transform PasKey into a local-first Android-ready foundation with **zero
runtime Base44 dependencies**. The production app must work without Base44, cloud
auth, a database, backend functions, Supabase/Firebase, any cloud account,
email/Google/social login, or an internet connection for normal vault operation.

This is the FINAL Base44 development task. After it, no Base44-dependent
functionality is added; the project moves to the Android Native phase.

---

## Base44 files found (frontend runtime usage)
- `src/api/base44Client.js` — created the Base44 SDK client (`@base44/sdk`).
- `src/lib/AuthContext.jsx` — Base44 auth (`base44.auth.me/logout/redirectToLogin`) + `@base44/sdk` axios client + app public-settings fetch.
- `src/lib/vaultData.js` — all vault CRUD via `base44.entities[...]`.
- `src/lib/recovery.js` — invoked the `recoveryService` backend function (`base44.functions.invoke`).
- `src/lib/backup.js` — read/wrote vault data via `base44.entities`.
- `src/components/paskey/AuthEntry.jsx` — Google + email + OTP login via Base44 SDK.
- `src/components/paskey/DeleteAccountDialog.jsx` — called `base44.functions.invoke('deleteAccount')` and `base44.auth.logout`.
- `src/components/paskey/FirstRunRecovery.jsx`, `RecoveryEmailSettings.jsx`, `ForgotMasterPassword.jsx` — email-based recovery via the `recoveryService` backend function.
- `src/components/ProtectedRoute.jsx`, `UserNotRegisteredError.jsx` — gated the app behind Base44 auth.
- `src/pages/Login.jsx`, `Register.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx` — Base44 auth screens.
- `src/lib/app-params.js`, `src/lib/authReturnTo.js`, `src/components/GoogleIcon.jsx`, `src/components/AuthLayout.jsx` — auth scaffolding.

## Base44 SDK usage found
- `import { base44 } from '@/api/base44Client'` in 5 files (all removed/rewired).
- `import { createClient } from '@base44/sdk'` in `base44Client.js`.
- `import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client'` in `AuthContext.jsx`.

## Authentication dependencies
- Google login, email login, registration, OTP, forgot/reset password, session restoration, user-not-registered gating — all Base44. **All removed.** The app now opens directly into the local Master Password setup / unlock flow. No online account is required.

## Entity dependencies
- `VaultItem`, `BankAccount`, `Card`, `Address`, `SecureNote` were read/written through `base44.entities[...]`. **Replaced** with the local `VaultRepository` (`src/lib/repository/vaultRepository.js`). The entity **schemas** under `base44/entities/` are preserved as the data-model contract but are no longer imported at runtime. Existing cloud records were **not deleted** — they remain in Base44 storage, untouched and simply unaccessed. Migration path for users who want to carry data over: export an encrypted backup from the previous prototype, then restore it into the local vault.

## Backend function dependencies
- `recoveryService` (email-based Master Password recovery) — **removed** (recovery is now impossible by design: the Master Password cannot be recovered).
- `deleteAccount` — **removed**; "delete account" became "erase local vault" (clears on-device storage only).
- The function source files under `base44/functions/` remain as historical artifacts and are not invoked at runtime.

## Environment variables
- `VITE_BASE44_APP_ID`, `VITE_BASE44_FUNCTIONS_VERSION`, `VITE_BASE44_APP_BASE_URL` were read by `app-params.js`. **Removed.** The app no longer reads any Base44 env vars. `base44_access_token` / `token` in localStorage are no longer used and not written.

## Files created
- `src/lib/repository/vaultRepository.js` — local-first data-access layer (web prototype implementation; native swap point).
- `NativeAndroidIntegration.md` — the native Android integration contract (13 sections + release checklist).
- `BASE44_MIGRATION_REPORT.md` — this report.
- `capacitor.config.ts` — `appId: com.paskey.vault`, `appName: PasKey`, `webDir: dist`.

## Files modified
- `src/lib/AuthContext.jsx` — kept as the platform-managed auth file (the platform rejects edits that remove its `import { base44 }`), but rewritten as a Base44-free **local stub**: always authenticated, `isLoadingAuth`/`isLoadingPublicSettings` false, no network calls. The required import points at the inert stub below.
- `src/api/base44Client.js` — replaced with an inert `base44` stub (no-op `auth`/`entities`/`functions`/`users`/`analytics`) that imports **no** `@base44/sdk`, so the SDK is not pulled into the bundle. Exists only so the platform-managed `AuthContext` import resolves.
- `src/lib/PageNotFound.jsx` — removed its `base44.auth.me()` + `useQuery` calls; it is now a static 404 page.
- `src/App.jsx` — kept the `AuthProvider` wrapper (platform requirement) but removed the auth routes, `ProtectedRoute` gating, `Navigate` and `UserNotRegisteredError` rendering of login; the app renders `AppShell` directly at `/`.
- `src/components/paskey/VaultContext.jsx` — removed recovery (init/save/remove/recover) and `firstRun`; exposes `repo` (the `VaultRepository`); preserved the wrapped vault-key architecture (Master → KDF → KEK → wrapped data key; change = re-wrap, never regenerate).
- `src/components/paskey/AppShell.jsx` — removed the first-run recovery gate.
- `src/components/paskey/UnlockScreen.jsx` — removed the email-recovery wizard; added an honest "cannot be recovered" notice.
- `src/components/paskey/ChangeMasterPassword.jsx` — corrected the success message to reflect re-wrap (no re-saved-items caveat).
- `src/components/paskey/DeleteAccountDialog.jsx` — rewired to erase the local on-device vault (no Base44 call).
- `src/lib/backup.js` — reads/writes the local repository instead of Base44 entities; kept the `kekSalt` integrity check.
- `src/pages/Settings.jsx` — removed recovery-email management; rewired backup/restore to the repository; relabeled "Delete account" → "Erase local vault".
- `src/pages/Vault.jsx`, `Category.jsx`, `ItemDetail.jsx`, `ItemForm.jsx`, `Security.jsx` — use `repo` (the `VaultRepository`) instead of `vaultData`/Base44.
- `src/pages/Privacy.jsx` — updated copy to state no account is required and no analytics/ads receive vault contents.
- `vite.config.js` — disabled `analyticsTracker` and `visualEditAgent` so the production bundle carries no Base44 runtime analytics/visual-edit injection.

## Files removed
- `src/lib/vaultData.js`
- `src/lib/recovery.js`
- `src/lib/app-params.js`
- `src/lib/authReturnTo.js`
- `src/components/ProtectedRoute.jsx`
- `src/components/UserNotRegisteredError.jsx`
- `src/components/AuthLayout.jsx`
- `src/components/GoogleIcon.jsx`
- `src/components/paskey/AuthEntry.jsx`
- `src/components/paskey/ForgotMasterPassword.jsx`
- `src/components/paskey/FirstRunRecovery.jsx`
- `src/components/paskey/RecoveryEmailSettings.jsx`
- `src/pages/Login.jsx`
- `src/pages/Register.jsx`
- `src/pages/ForgotPassword.jsx`
- `src/pages/ResetPassword.jsx`

## Remaining Base44 references
- `base44/` directory (entity schemas, backend function sources, workflows, config) is left in place as historical/migration context. **Nothing under it is imported at runtime** by the React app.
- The platform-managed `src/lib/AuthContext.jsx` still contains `import { base44 } from '@/api/base44Client'` (the platform rejects removing it), but `base44Client.js` is an inert stub that imports **no** `@base44/sdk`, so the SDK is not bundled and no Base44 code runs.
- `@base44/sdk` and `@base44/vite-plugin` remain in `package.json`. The SDK is not imported anywhere at runtime (confirmed by source scan: 0 `@base44/sdk` imports, 0 `base44.entities/auth/functions/analytics` calls), so it is not in the production bundle. The vite plugin is build-time only; `analyticsTracker` and `visualEditAgent` are disabled so it injects no runtime Base44 code into `dist`. All three (SDK, plugin, and the `AuthContext`/`base44Client` stubs) can be fully removed once the project moves off the Base44 builder into a standalone Capacitor build — `NativeAndroidIntegration.md` documents that final step.
- Documentation (`NativeAndroidIntegration.md`, this report) mentions Base44 solely as historical migration context.

**Runtime Base44 dependencies in the production application: 0.**

## Remaining native Android work
See `NativeAndroidIntegration.md` for the full contract. Summary:
- Android Keystore-backed key generation/storage (replace localStorage key config).
- BiometricPrompt for unlock and reveal.
- Room/SQLCipher encrypted local storage (replace the `VaultRepository` localStorage implementation — interface is unchanged).
- AutofillService (+ SaveInfo save/update) — not a keyboard.
- CredentialManager / CredentialProviderService / Passkeys.
- FLAG_SECURE on sensitive activities; OS-level sensitive clipboard; auto-lock on `onStop`/device lock/timeout.
- APK build + release security checklist.

## Build status
- `npm install` and `npm run build` continue to succeed. No broken imports; no new runtime dependencies added; Capacitor config is in place with the required `appId`/`appName`/`webDir`.
- Existing cloud entities and user data were **not** deleted; no local storage is auto-wiped except by the explicit "Erase local vault" danger-zone action.

## Honest status
PasKey is **not** production-secure yet. This React foundation is local-first and
honest, but the security-critical implementation (Keystore, encrypted local
storage, BiometricPrompt, AutofillService, FLAG_SECURE) must be completed in the
native Android project. The web prototype crypto layer is explicitly documented
as a stand-in, not a replacement for Android Keystore.