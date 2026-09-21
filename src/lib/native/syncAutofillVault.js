import { Capacitor } from '@capacitor/core';
import {
  PasKeySecurity,
  getPendingAutofillSaves,
  removePendingAutofillSaves,
} from './PasKeySecurity';
import { getLoginProfile, isAutofillLogin } from '@/lib/loginProfiles';
import {
  autofillIdentity,
  buildAutofillTitle,
  isCompleteAutofillLogin,
  normalizeAutofillRecord,
} from '@/lib/autofillModel';

let pendingImportPromise = null;

function isAndroid() {
  return Capacitor.getPlatform() === 'android';
}

async function buildAutofillItems(repo, dec) {
  const items = await repo.listItems();
  const cardRecords = [];
  const autofillItems = [];

  for (const item of items) {
    if (item._category === 'cards') {
      cardRecords.push(item);
      continue;
    }
    if (!isAutofillLogin(item)) continue;

    try {
      const password = item.password ? await dec(item.password) : '';
      const image = item.avatar ? await dec(item.avatar) : '';
      const normalized = normalizeAutofillRecord({ ...item, password, image });
      if (!isCompleteAutofillLogin(normalized)) continue;

      const profile = getLoginProfile({ ...item, ...normalized });
      const identity = autofillIdentity(normalized).value;
      autofillItems.push({
        id: item.id,
        category: item._category || '',
        title: buildAutofillTitle({ ...normalized, provider: profile.provider.id }),
        displayTitle: profile.baseTitle,
        displaySubtitle: identity,
        provider: profile.provider.id,
        accountType: profile.identityType,
        accountIdentity: identity,
        website: normalized.website,
        applicationIdentifier: normalized.applicationIdentifier,
        username: normalized.username,
        email: normalized.email,
        phone: normalized.phone,
        password,
        image: /^data:image\//i.test(image) ? image : '',
        _paskeyPendingId: normalized._paskeyPendingId,
      });
    } catch {
      // A damaged legacy record stays in the vault but is never exposed to Android Autofill.
    }
  }

  for (const item of cardRecords) {
    const entry = {
      id: item.id,
      category: 'cards',
      title: item.name || 'Payment card',
      displayTitle: item.name || 'Payment card',
      displaySubtitle: item.cardholder || 'Payment card',
      website: '',
      applicationIdentifier: '',
      username: '',
      email: '',
      phone: '',
      provider: 'card',
    };
    entry.cardholder = item.cardholder || '';
    entry.expiry = item.expiry || '';
    if (item.number) entry.cardNumber = await dec(item.number);
    if (item.cvv) entry.cvv = await dec(item.cvv);
    autofillItems.push(entry);
  }

  return autofillItems;
}

// Sends only the already-unlocked vault to Android's encrypted Autofill cache.
// It never consumes pending Android save requests, so app start is safe.
export async function syncAutofillVault(repo, dec) {
  if (!isAndroid() || !repo) return { synced: 0 };
  const autofillItems = await buildAutofillItems(repo, dec);
  await PasKeySecurity.syncAutofillVault({ json: JSON.stringify(autofillItems) });
  return { synced: autofillItems.length };
}

// Pending saves are imported only after the user presses the Import button.
// The repository deduplicates by pending ID, so interrupted import cannot add
// the same Android save twice.
export async function importPendingAutofillSaves(repo) {
  if (!isAndroid() || !repo) return 0;
  if (pendingImportPromise) return pendingImportPromise;

  pendingImportPromise = (async () => {
    const pending = await getPendingAutofillSaves();
    if (!Array.isArray(pending) || pending.length === 0) return 0;

    const completedIds = [];
    let imported = 0;
    for (const item of pending) {
      const pendingId = String(item?._paskeyPendingId || item?.pendingId || '').trim();
      const normalized = normalizeAutofillRecord({
        ...item,
        _paskeyPendingId: pendingId,
        website: item?.website || item?.targetWebDomain || '',
        applicationIdentifier: item?.applicationIdentifier || item?.targetPackage || '',
      });
      if (!pendingId || !isCompleteAutofillLogin(normalized)) continue;

      const result = await repo.createItem('passwords', {
        title: normalized.title,
        website: normalized.website,
        applicationIdentifier: normalized.applicationIdentifier,
        username: normalized.username,
        email: normalized.email,
        phone: normalized.phone,
        password: normalized.password,
        avatar: /^data:image\//i.test(normalized.image) ? normalized.image : '',
        _paskeyPendingId: pendingId,
      });
      const stored = await repo.getItem('passwords', result.id);
      if (stored && isCompleteAutofillLogin(stored)) {
        if (!result.existing) imported += 1;
        completedIds.push(pendingId);
      }
    }

    if (completedIds.length > 0) {
      try { await removePendingAutofillSaves(completedIds); } catch { /* idempotent retry */ }
    }
    return imported;
  })();

  try {
    return await pendingImportPromise;
  } finally {
    pendingImportPromise = null;
  }
}

export async function importAndSyncAutofillVault(repo, dec) {
  const imported = await importPendingAutofillSaves(repo);
  const { synced } = await syncAutofillVault(repo, dec);
  return { imported, deduplicated: 0, synced };
}
