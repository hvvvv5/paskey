import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeVaultRows } from '../src/lib/repository/vaultMigration.js';

test('native migration preserves unique legacy and native records', () => {
  const rows = mergeVaultRows(
    [{ id: 'native', updated_date: '2026-01-02T00:00:00.000Z' }],
    [{ id: 'legacy', updated_date: '2026-01-01T00:00:00.000Z' }],
  );
  assert.deepEqual(rows.map((row) => row.id).sort(), ['legacy', 'native']);
});

test('native migration keeps the newest copy of duplicate ids', () => {
  const rows = mergeVaultRows(
    [{ id: 'same', value: 'native-old', updated_date: '2026-01-01T00:00:00.000Z' }],
    [{ id: 'same', value: 'legacy-new', updated_date: '2026-01-03T00:00:00.000Z' }],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].value, 'legacy-new');
});
