import { base44 } from '@/api/base44Client';
import { CATEGORIES, getCategory } from '@/lib/categories';

const api = (cat) => base44.entities[cat.entity];

export async function listCategory(catKey) {
  const cat = getCategory(catKey);
  if (!cat) return [];
  const query = cat.type ? { type: cat.type } : {};
  const rows = cat.type
    ? await api(cat).filter(query, '-updated_date')
    : await api(cat).list('-updated_date');
  return rows.map((r) => ({ ...r, _category: cat.key }));
}

export async function listAll() {
  const groups = await Promise.all(CATEGORIES.map((c) => listCategory(c.key)));
  return groups.flat();
}

export async function getItem(catKey, id) {
  const cat = getCategory(catKey);
  const row = await api(cat).get(id);
  return { ...row, _category: cat.key };
}

export async function saveItem(catKey, id, values, enc) {
  const cat = getCategory(catKey);
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
  return id ? api(cat).update(id, payload) : api(cat).create(payload);
}

export async function deleteItem(catKey, id) {
  return api(getCategory(catKey)).delete(id);
}

export async function toggleFavorite(catKey, id, favorite) {
  return api(getCategory(catKey)).update(id, { favorite });
}

export async function markUsed(catKey, id) {
  const cat = getCategory(catKey);
  if (cat.entity !== 'VaultItem') return;
  return api(cat).update(id, { lastUsedAt: new Date().toISOString() });
}