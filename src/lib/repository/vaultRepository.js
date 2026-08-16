import { CATEGORIES, getCategory } from '@/lib/categories';
import { scorePassword } from '@/lib/password';

// VaultRepository — local-first data-access layer for PasKey.
//
// WEB PROTOTYPE implementation: records persist in the browser's localStorage;
// sensitive fields are sealed with AES-256-GCM via the injected enc/dec pair
// (bound to the unlocked vault key). This is NOT secure production storage.
// The production Android build replaces this module with a native Room/SQLCipher
// repository backed by the Android Keystore. The UI depends only on this
// interface, so the native swap requires no UI changes.
//
// Sensitive fields (password, notes, number, cvv, pin, accountNumber, iban,
// recoveryPhone, content) are stored as ciphertext. Metadata (title, name,
// website, username, email, category, favorite, timestamps) stays plaintext so
// it can be searched and listed without ever decrypting a secret.

const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const now = () => new Date().toISOString();
const KEY = (entity) => `paskey.data.${entity}`;
const YEAR_MS = 365 * 24 * 3600 * 1000;

function readRows(entity) {
  try { return JSON.parse(localStorage.getItem(KEY(entity)) || '[]'); } catch { return []; }
}
function writeRows(entity, rows) {
  localStorage.setItem(KEY(entity), JSON.stringify(rows));
}

async function buildPayload(cat, values, enc) {
  const payload = {};
  for (const f of cat.fields) {
    const raw = values[f.name] ?? '';
    if (f.name === 'tags') {
      payload.tags = String(raw).split(',').map((t) => t.trim()).filter(Boolean);
      continue;
    }
    payload[f.name] = f.sensitive ? await enc(raw) : raw;
  }
  if (cat.type) payload.type = cat.type;
  if ('favorite' in values) payload.favorite = !!values.favorite;
  return payload;
}

function byUpdatedDesc(rows) {
  return rows.sort((a, b) => new Date(b.updated_date || 0) - new Date(a.updated_date || 0));
}

export function createVaultRepository({ enc, dec }) {
  const listCategory = async (catKey) => {
    const cat = getCategory(catKey);
    if (!cat) return [];
    const rows = readRows(cat.entity);
    const filtered = cat.type ? rows.filter((r) => r.type === cat.type) : rows.slice();
    return byUpdatedDesc(filtered).map((r) => ({ ...r, _category: cat.key }));
  };

  const listItems = async () => {
    const groups = await Promise.all(CATEGORIES.map((c) => listCategory(c.key)));
    return groups.flat();
  };

  const getItem = async (catKey, id) => {
    const cat = getCategory(catKey);
    if (!cat) return null;
    const row = readRows(cat.entity).find((r) => r.id === id);
    return row ? { ...row, _category: cat.key } : null;
  };

  const createItem = async (catKey, values) => {
    const cat = getCategory(catKey);
    if (!cat) throw new Error('Unknown category');
    const payload = await buildPayload(cat, values, enc);
    const row = { id: uid(), created_date: now(), updated_date: now(), ...payload };
    const rows = readRows(cat.entity);
    rows.push(row);
    writeRows(cat.entity, rows);
    return { id: row.id };
  };

  const updateItem = async (catKey, id, values) => {
    const cat = getCategory(catKey);
    if (!cat) throw new Error('Unknown category');
    const rows = readRows(cat.entity);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('Item not found');
    const payload = await buildPayload(cat, values, enc);
    rows[idx] = { ...rows[idx], ...payload, updated_date: now() };
    writeRows(cat.entity, rows);
    return { ...rows[idx], _category: cat.key };
  };

  const deleteItem = async (catKey, id) => {
    const cat = getCategory(catKey);
    if (!cat) return;
    writeRows(cat.entity, readRows(cat.entity).filter((r) => r.id !== id));
  };

  const toggleFavorite = async (catKey, id, favorite) => {
    const cat = getCategory(catKey);
    if (!cat) return;
    const rows = readRows(cat.entity);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) return;
    rows[idx] = { ...rows[idx], favorite: !!favorite, updated_date: now() };
    writeRows(cat.entity, rows);
    return { ...rows[idx], _category: cat.key };
  };

  const markUsed = async (catKey, id) => {
    const cat = getCategory(catKey);
    if (!cat || cat.entity !== 'VaultItem') return;
    const rows = readRows(cat.entity);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) return;
    rows[idx] = { ...rows[idx], lastUsedAt: now(), updated_date: now() };
    writeRows(cat.entity, rows);
  };

  // Search metadata only. Sensitive values (passwords, CVV, PIN, notes, …) are
  // never indexed and never searched.
  const searchItems = async (query) => {
    const t = String(query || '').trim().toLowerCase();
    if (!t) return [];
    const items = await listItems();
    return items.filter((i) => {
      const cat = getCategory(i._category);
      const hay = [
        i[cat.titleField], i.website, i.username, i.email, i.applicationIdentifier,
        i.provider, i.bankName, i.name, cat.label, (i.tags || []).join(' '),
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(t);
    });
  };

  // All analysis runs locally on the device. Nothing is ever uploaded.
  const getSecurityStatistics = async (settings = {}) => {
    const items = await listItems();
    const withPw = [];
    for (const i of items) {
      if (!i.password) continue;
      withPw.push({ item: i, value: await dec(i.password) });
    }
    const weak = withPw.filter((r) => scorePassword(r.value).score < 55);
    const seen = {};
    withPw.forEach((r) => { if (r.value) seen[r.value] = (seen[r.value] || 0) + 1; });
    const reused = withPw.filter((r) => r.value && seen[r.value] > 1);
    const missing = items.filter((i) => {
      const cat = getCategory(i._category);
      return cat.fields.some((f) => f.name === 'password') && !i.password;
    });
    const old = items.filter((i) => {
      const d = new Date(i.updated_date || i.created_date);
      return Date.now() - d.getTime() > YEAR_MS;
    });
    let score = 100;
    score -= weak.length * 8;
    score -= reused.length * 6;
    score -= missing.length * 4;
    score -= old.length * 2;
    if (!settings.biometricUnlock) score -= 5;
    if (settings.autoLockMinutes === -1) score -= 8;
    return { total: items.length, weak, reused, missing, old, score: Math.max(0, Math.min(100, score)) };
  };

  // Backup / restore: raw ciphertext records (no plaintext, no Master Password).
  const exportRaw = () => {
    const data = {};
    for (const c of CATEGORIES) if (!(c.entity in data)) data[c.entity] = readRows(c.entity);
    return data;
  };

  const importRaw = (data) => {
    let count = 0;
    for (const c of CATEGORIES) {
      const rows = Array.isArray(data?.[c.entity]) ? data[c.entity] : [];
      const existing = readRows(c.entity);
      const byId = new Map(existing.map((r) => [r.id, r]));
      for (const r of rows) {
        const row = { ...r };
        if (!row.id) row.id = uid();
        byId.set(row.id, row);
        count += 1;
      }
      writeRows(c.entity, Array.from(byId.values()));
    }
    return count;
  };

  // Danger zone: permanently erase every encrypted record from this device.
  const eraseAll = () => {
    for (const c of CATEGORIES) localStorage.removeItem(KEY(c.entity));
  };

  return {
    listCategory, listItems, getItem, createItem, updateItem, deleteItem,
    toggleFavorite, markUsed, searchItems, getSecurityStatistics,
    exportRaw, importRaw, eraseAll,
  };
}