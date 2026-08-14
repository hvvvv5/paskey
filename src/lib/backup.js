import { base44 } from '@/api/base44Client';
import { CATEGORIES } from '@/lib/categories';

const ENTITIES = [...new Set(CATEGORIES.map((c) => c.entity))];

// Sensitive fields are already AES-256-GCM ciphertext, so the export never contains
// plaintext secrets and never contains the Master Password.
export async function buildBackup(config) {
  const data = {};
  for (const name of ENTITIES) {
    const rows = await base44.entities[name].list();
    data[name] = rows.map(({ id, created_date, updated_date, created_by_id, ...rest }) => rest);
  }
  return {
    format: 'PasKey Encrypted Vault',
    version: 1,
    exportedAt: new Date().toISOString(),
    encryption: { cipher: 'AES-256-GCM', kdf: config.kdf, iterations: config.iterations, salt: config.salt, verifier: config.verifier },
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

export async function restoreBackup(file, config) {
  const parsed = JSON.parse(await file.text());
  if (parsed.format !== 'PasKey Encrypted Vault') throw new Error('This file is not a PasKey encrypted backup.');
  if (parsed.encryption?.salt !== config.salt) {
    throw new Error('This backup was created with a different Master Password and cannot be decrypted by this vault.');
  }
  let restored = 0;
  for (const name of ENTITIES) {
    const rows = parsed.data?.[name] || [];
    if (rows.length) {
      await base44.entities[name].bulkCreate(rows);
      restored += rows.length;
    }
  }
  return restored;
}