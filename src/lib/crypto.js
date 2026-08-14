// Browser WebCrypto layer used by the PasKey prototype vault.
// NOTE: In the production Android build these operations must be performed by the
// native security layer (Android Keystore + Argon2id/PBKDF2 + AES-256-GCM).
const te = new TextEncoder();
const td = new TextDecoder();

export const ITERATIONS = 310000;

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function randomSalt() {
  return b64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function deriveKey(password, saltB64, iterations = ITERATIONS) {
  const base = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: unb64(saltB64), iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptText(key, text) {
  if (!text) return '';
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(String(text)));
  return `v1.${b64(iv)}.${b64(ct)}`;
}

export async function decryptText(key, payload) {
  if (!payload || typeof payload !== 'string' || !payload.startsWith('v1.')) return '';
  const [, ivb, ctb] = payload.split('.');
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(ivb) }, key, unb64(ctb));
    return td.decode(pt);
  } catch {
    return '';
  }
}

export const VERIFY_TOKEN = 'PASKEY_VAULT_VERIFIER';

// --- Wrapped vault-key layer (recovery support) -----------------------------
// The vault data key K is a random AES-GCM key, independent of the master
// password. K is wrapped (encrypted) with a master-password KEK and, when a
// recovery email is set, with a random recovery key R. R is held by the
// recovery backend (encrypted with a server secret) and released only after a
// verified email code. Changing the master password only re-wraps K, so vault
// data never needs re-encryption and the old password is never recoverable.

export async function generateDataKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

export async function exportRaw(key) {
  const raw = await crypto.subtle.exportKey('raw', key);
  return b64(raw);
}

export async function importRaw(b64str) {
  return crypto.subtle.importKey('raw', unb64(b64str), 'AES-GCM', true, ['encrypt', 'decrypt']);
}

// Wrap a data key with a wrapping key (KEK or recovery key). Returns a v1 payload string.
export async function wrapKey(dataKey, wrappingKey) {
  const raw = await crypto.subtle.exportKey('raw', dataKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, raw);
  return `v1.${b64(iv)}.${b64(ct)}`;
}

// Unwrap a data key from a v1 payload using a wrapping key.
export async function unwrapKey(payload, wrappingKey) {
  const [, ivb, ctb] = payload.split('.');
  const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(ivb) }, wrappingKey, unb64(ctb));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']);
}

// 256-bit recovery key as base64 (32 random bytes). Imported as an AES-GCM key
// when used for wrapping/unwrapping.
export function generateRecoveryKey() {
  return b64(crypto.getRandomValues(new Uint8Array(32)));
}