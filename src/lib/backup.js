import { CATEGORIES } from '@/lib/categories';

// Encrypted backup / restore for the local-first vault.
// The export contains only AES-256-GCM ciphertext (sensitive fields are already
// sealed by the repository) plus the vault config needed to validate the Master
// Password on restore. It never contains plaintext secrets and never contains
// the Master Password. This is a web/prototype backup of the local encrypted
// store — the native Android build uses on-device Room/SQLCipher storage.

export async function buildBackup(repo, config) {
  const data = repo.exportRaw();
  return {
    format: 'PasKey Encrypted Vault',
    version: 1,
    exportedAt: new Date().toISOString(),
    encryption: {
      cipher: 'AES-256-GCM',
      kdf: config.kdf,
      iterations: config.iterations,
      kekSalt: config.kekSalt,
      verifier: config.verifier,
    },
    data,
  };
}

export function downloadBackup(backup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `paskey-vault-${new Date().toISOString().slice(0, 10)}.paskey.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function restoreBackup(file, repo, config) {
  const parsed = JSON.parse(await file.text());
  if (parsed.format !== 'PasKey Encrypted Vault') {
    throw new Error('This file is not a PasKey encrypted backup.');
  }
  if (parsed.encryption?.kekSalt !== config.kekSalt) {
    throw new Error('This backup was created with a different Master Password and cannot be decrypted by this vault.');
  }
  return repo.importRaw(parsed.data || {});
}