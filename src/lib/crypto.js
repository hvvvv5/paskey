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