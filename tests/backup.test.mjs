import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, restoreBackup } from '../src/lib/backup.js';

test('backup encrypts the entire raw repository snapshot', async () => {
  const raw = { VaultItem: [{ id: '1', title: 'Example', password: 'cipher' }] };
  const repo = { exportRaw: async () => raw };
  const config = { kdf: 'PBKDF2-HMAC-SHA256', iterations: 600000, kekSalt: 'salt', verifier: 'verifier' };
  const enc = async (text) => `sealed:${text}`;
  const backup = await buildBackup(repo, config, enc);
  assert.equal(backup.version, 2);
  assert.equal(backup.format, 'PasKey Encrypted Vault');
  assert.equal(backup.ciphertext, `sealed:${JSON.stringify(raw)}`);
  assert.equal('data' in backup, false);
});

test('restore decrypts version 2 backup then imports repository data', async () => {
  const raw = { VaultItem: [{ id: '1', title: 'Example' }] };
  const parsed = {
    format: 'PasKey Encrypted Vault',
    version: 2,
    encryption: { kekSalt: 'salt' },
    ciphertext: 'sealed',
  };
  const file = { text: async () => JSON.stringify(parsed) };
  let imported = null;
  const repo = { importRaw: async (data) => { imported = data; return 1; } };
  const count = await restoreBackup(file, repo, { kekSalt: 'salt' }, async () => JSON.stringify(raw));
  assert.equal(count, 1);
  assert.deepEqual(imported, raw);
});

test('restore rejects backups protected by a different master-password wrapper', async () => {
  const file = {
    text: async () => JSON.stringify({
      format: 'PasKey Encrypted Vault',
      version: 2,
      encryption: { kekSalt: 'different' },
      ciphertext: 'sealed',
    }),
  };
  await assert.rejects(
    restoreBackup(file, { importRaw: async () => 0 }, { kekSalt: 'current' }, async () => '{}'),
    /different Master Password/,
  );
});

test('restore rejects non-PasKey files', async () => {
  const file = { text: async () => JSON.stringify({ format: 'Other' }) };
  await assert.rejects(
    restoreBackup(file, { importRaw: async () => 0 }, { kekSalt: 'salt' }, async () => '{}'),
    /not a PasKey encrypted backup/,
  );
});
