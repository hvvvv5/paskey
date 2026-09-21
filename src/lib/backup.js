// Encrypted backup / restore for the local-first vault.
// Version 2 seals the complete exported repository (including metadata) with
// the already-unlocked AES-256-GCM vault key. Version 1 remains readable for
// upgrades from older builds, but new exports never expose record metadata.

export async function buildBackup(repo, config, enc) {
  const data = await repo.exportRaw();
  if (typeof enc !== 'function') throw new Error('Vault encryption is unavailable.');
  return {
    format: 'PasKey Encrypted Vault',
    version: 2,
    exportedAt: new Date().toISOString(),
    encryption: {
      cipher: 'AES-256-GCM',
      kdf: config.kdf,
      iterations: config.iterations,
      kekSalt: config.kekSalt,
      verifier: config.verifier,
    },
    ciphertext: await enc(JSON.stringify(data)),
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

export async function restoreBackup(file, repo, config, dec) {
  const parsed = JSON.parse(await file.text());
  if (parsed.format !== 'PasKey Encrypted Vault') {
    throw new Error('This file is not a PasKey encrypted backup.');
  }
  if (parsed.encryption?.kekSalt !== config.kekSalt) {
    throw new Error('This backup was created with a different Master Password and cannot be decrypted by this vault.');
  }
  if (parsed.version >= 2) {
    if (typeof dec !== 'function' || typeof parsed.ciphertext !== 'string') {
      throw new Error('This encrypted backup is missing its vault ciphertext.');
    }
    let data;
    try {
      data = JSON.parse(await dec(parsed.ciphertext));
    } catch {
      throw new Error('This backup could not be decrypted by the current vault.');
    }
    return repo.importRaw(data || {});
  }
  // Legacy v1 backups contain encrypted secret fields but plaintext metadata.
  return repo.importRaw(parsed.data || {});
}
