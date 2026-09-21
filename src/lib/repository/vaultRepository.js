import { CATEGORIES, getCategory } from '@/lib/categories';
import { scorePassword } from '@/lib/password';
import { Capacitor } from '@capacitor/core';
import {
  readNativeVaultEntity,
  writeNativeVaultEntity,
  clearNativeVaultStorage,
} from '@/lib/native/PasKeySecurity';
import { mergeVaultRows } from '@/lib/repository/vaultMigration';

const uid = () => (
  crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
);
const now = () => new Date().toISOString();
const KEY = (entity) => `paskey.data.${entity}`;
const YEAR_MS = 365 * 24 * 3600 * 1000;

function readLocalRows(entity) {
  try { return JSON.parse(localStorage.getItem(KEY(entity)) || '[]'); } catch { return []; }
}
function writeLocalRows(entity, rows) {
  localStorage.setItem(KEY(entity), JSON.stringify(rows));
}

async function buildPayload(cat, values, enc) {
  const payload = {};
  for (const field of cat.fields) {
    const raw = values[field.name] ?? '';
    if (field.name === 'tags') {
      payload.tags = String(raw).split(',').map((tag) => tag.trim()).filter(Boolean);
      continue;
    }
    payload[field.name] = field.sensitive ? await enc(raw) : raw;
  }
  if (cat.type) payload.type = cat.type;
  if ('favorite' in values) payload.favorite = !!values.favorite;
  return payload;
}

function byUpdatedDesc(rows) {
  return rows.sort((a, b) => (
    new Date(b.updated_date || 0).getTime() - new Date(a.updated_date || 0).getTime()
  ));
}

function pendingIdOf(row) {
  return String(row?._paskeyPendingId || '').trim();
}

function richness(row) {
  const keys = ['title', 'website', 'applicationIdentifier', 'username', 'email', 'phone', 'password'];
  return keys.reduce((score, key) => score + (row?.[key] ? 1 : 0), 0);
}

export function createVaultRepository({ enc, dec }) {
  let mutationQueue = Promise.resolve();
  let nativeStorage = Capacitor.getPlatform() === 'android';
  const cache = new Map();
  const entities = [...new Set(CATEGORIES.map((category) => category.entity))];

  // Native storage is authoritative on Android. Existing localStorage rows
  // are merged by id/date and removed only after the Room write succeeds.
  const ready = (async () => {
    let migrationFailed = false;
    for (const entity of entities) {
      const localRows = readLocalRows(entity);
      if (!nativeStorage) {
        cache.set(entity, localRows);
        continue;
      }
      try {
        const nativeRows = await readNativeVaultEntity(entity);
        const rows = mergeVaultRows(nativeRows, localRows);
        if (rows.length !== nativeRows.length || rows.some((row) => !nativeRows.some((candidate) => candidate.id === row.id && candidate.updated_date === row.updated_date))) {
          await writeNativeVaultEntity(entity, rows);
        }
        cache.set(entity, rows);
      } catch {
        // Preserve local data if the native database is unavailable or its
        // Keystore key cannot decrypt it. The vault remains usable in legacy
        // mode and the next unlock retries migration.
        migrationFailed = true;
        cache.set(entity, localRows);
      }
    }
    if (!migrationFailed && nativeStorage) {
      for (const entity of entities) localStorage.removeItem(KEY(entity));
    }
    if (migrationFailed) nativeStorage = false;
  })();

  const readRows = async (entity) => {
    await ready;
    return cache.get(entity) || [];
  };
  const writeRows = async (entity, rows) => {
    await ready;
    const snapshot = Array.isArray(rows) ? rows : [];
    if (nativeStorage) {
      await writeNativeVaultEntity(entity, snapshot);
    } else {
      writeLocalRows(entity, snapshot);
    }
    cache.set(entity, snapshot);
  };

  const serializeMutation = (operation) => {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.catch(() => {});
    return result;
  };

  const listCategory = async (catKey) => {
    const cat = getCategory(catKey);
    if (!cat) return [];
    const rows = await readRows(cat.entity);
    const filtered = cat.type ? rows.filter((row) => row.type === cat.type) : rows.slice();
    return byUpdatedDesc(filtered).map((row) => ({ ...row, _category: cat.key }));
  };

  const listItems = async () => {
    const groups = await Promise.all(CATEGORIES.map((category) => listCategory(category.key)));
    return groups.flat();
  };

  const getItem = async (catKey, id) => {
    const cat = getCategory(catKey);
    if (!cat) return null;
    const row = (await readRows(cat.entity)).find((candidate) => candidate.id === id);
    return row ? { ...row, _category: cat.key } : null;
  };

  const createItem = (catKey, values) => serializeMutation(async () => {
    const cat = getCategory(catKey);
    if (!cat) throw new Error('Unknown category');

    const pendingId = String(values?._paskeyPendingId || '').trim();
    const rows = await readRows(cat.entity);

    // This runs in a repository-level queue. Two import taps therefore cannot
    // read the same empty snapshot and write duplicate pending records.
    if (pendingId) {
      const existing = rows.find((row) => pendingIdOf(row) === pendingId);
      if (existing) return { id: existing.id, existing: true };
    }

    const payload = await buildPayload(cat, values, enc);
    const row = {
      id: uid(),
      created_date: now(),
      updated_date: now(),
      ...payload,
      ...(pendingId ? { _paskeyPendingId: pendingId } : {}),
    };
    rows.push(row);
    await writeRows(cat.entity, rows);
    return { id: row.id, existing: false };
  });

  const updateItem = async (catKey, id, values) => {
    const cat = getCategory(catKey);
    if (!cat) throw new Error('Unknown category');
    const rows = await readRows(cat.entity);
    const index = rows.findIndex((row) => row.id === id);
    if (index === -1) throw new Error('Item not found');
    const payload = await buildPayload(cat, values, enc);
    rows[index] = { ...rows[index], ...payload, updated_date: now() };
    await writeRows(cat.entity, rows);
    return { ...rows[index], _category: cat.key };
  };

  const deleteItem = async (catKey, id) => {
    const cat = getCategory(catKey);
    if (!cat) return;
    await writeRows(cat.entity, (await readRows(cat.entity)).filter((row) => row.id !== id));
  };

  const toggleFavorite = async (catKey, id, favorite) => {
    const cat = getCategory(catKey);
    if (!cat) return;
    const rows = await readRows(cat.entity);
    const index = rows.findIndex((row) => row.id === id);
    if (index === -1) return;
    rows[index] = { ...rows[index], favorite: !!favorite, updated_date: now() };
    await writeRows(cat.entity, rows);
    return { ...rows[index], _category: cat.key };
  };

  const markUsed = async (catKey, id) => {
    const cat = getCategory(catKey);
    if (!cat || cat.entity !== 'VaultItem') return;
    const rows = await readRows(cat.entity);
    const index = rows.findIndex((row) => row.id === id);
    if (index === -1) return;
    rows[index] = { ...rows[index], lastUsedAt: now(), updated_date: now() };
    await writeRows(cat.entity, rows);
  };

  const dedupePendingLogins = async () => {
    const entities = [...new Set(CATEGORIES.map((category) => category.entity))];
    let removed = 0;

    for (const entity of entities) {
      const rows = await readRows(entity);
      const chosen = new Map();
      let removedFromEntity = 0;
      const noPending = [];

      for (const row of rows) {
        const pendingId = pendingIdOf(row);
        if (!pendingId) {
          noPending.push(row);
          continue;
        }

        const previous = chosen.get(pendingId);
        if (!previous) {
          chosen.set(pendingId, row);
          continue;
        }

        const keepCurrent = richness(row) > richness(previous)
          || (richness(row) === richness(previous)
            && new Date(row.updated_date || 0) > new Date(previous.updated_date || 0));
        chosen.set(pendingId, keepCurrent ? row : previous);
        removed += 1;
        removedFromEntity += 1;
      }

      if (removedFromEntity > 0) await writeRows(entity, [...noPending, ...chosen.values()]);
    }

    return removed;
  };

  const searchItems = async (query) => {
    const term = String(query || '').trim().toLowerCase();
    if (!term) return [];
    const items = await listItems();
    return items.filter((item) => {
      const cat = getCategory(item._category);
      const haystack = [
        item[cat.titleField], item.website, item.username, item.email, item.phone,
        item.applicationIdentifier, item.provider, item.profileLabel, item.bankName,
        item.name, cat.label, (item.tags || []).join(' '),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(term);
    });
  };

  const getSecurityStatistics = async (settings = {}) => {
    const items = await listItems();
    const withPassword = [];
    for (const item of items) {
      if (!item.password) continue;
      withPassword.push({ item, value: await dec(item.password) });
    }
    const weak = withPassword.filter((entry) => scorePassword(entry.value).score < 55);
    const seen = {};
    withPassword.forEach((entry) => {
      if (entry.value) seen[entry.value] = (seen[entry.value] || 0) + 1;
    });
    const reused = withPassword.filter((entry) => entry.value && seen[entry.value] > 1);
    const missing = items.filter((item) => {
      const cat = getCategory(item._category);
      return cat.fields.some((field) => field.name === 'password') && !item.password;
    });
    const old = items.filter((item) => {
      const date = new Date(item.updated_date || item.created_date);
      return Date.now() - date.getTime() > YEAR_MS;
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

  const exportRaw = async () => {
    await ready;
    const data = {};
    for (const category of CATEGORIES) {
      if (!(category.entity in data)) data[category.entity] = await readRows(category.entity);
    }
    return data;
  };

  const importRaw = async (data) => {
    await ready;
    let count = 0;
    for (const category of CATEGORIES) {
      const rows = Array.isArray(data?.[category.entity]) ? data[category.entity] : [];
      const existing = await readRows(category.entity);
      const byId = new Map(existing.map((row) => [row.id, row]));
      for (const candidate of rows) {
        const row = { ...candidate };
        if (!row.id) row.id = uid();
        byId.set(row.id, row);
        count += 1;
      }
      await writeRows(category.entity, Array.from(byId.values()));
    }
    return count;
  };

  const eraseAll = async () => {
    await ready;
    if (nativeStorage) await clearNativeVaultStorage();
    for (const category of CATEGORIES) {
      cache.delete(category.entity);
      localStorage.removeItem(KEY(category.entity));
    }
  };

  return {
    listCategory, listItems, getItem, createItem, updateItem, deleteItem,
    toggleFavorite, markUsed, dedupePendingLogins, searchItems,
    getSecurityStatistics, exportRaw, importRaw, eraseAll,
  };
}
