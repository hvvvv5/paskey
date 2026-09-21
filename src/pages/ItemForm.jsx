// Vault rows are intentionally category-shaped at runtime; field validation
// comes from the category schema before persistence.
// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ImagePlus, Wand2 } from 'lucide-react';
import { getCategory } from '@/lib/categories';
import { useVault } from '@/components/paskey/VaultContext';
import { generatePassword } from '@/lib/password';
import { getProviderPreset } from '@/lib/loginProfiles';
import { syncAutofillVault } from '@/lib/native/syncAutofillVault';
import { useI18n } from '@/lib/i18n';

const MAX_AVATAR_BYTES = 750 * 1024;

export default function ItemForm() {
  const { cat: catKey, id } = useParams();
  const cat = getCategory(catKey);
  const { repo, dec } = useVault();
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (name, value) => setValues((previous) => ({ ...previous, [name]: value }));

  useEffect(() => {
    if (!id || !cat || !repo) return;
    let active = true;

    (async () => {
      const row = await repo.getItem(cat.key, id);
      if (!row || !active) return;
      const next = { favorite: !!row.favorite };
      for (const field of cat.fields) {
        if (field.name === 'tags') {
          next.tags = (row.tags || []).join(', ');
        } else if (field.name === 'provider') {
          next.provider = getProviderPreset(row.provider)?.id || row.provider || '';
        } else if (field.sensitive) {
          next[field.name] = row[field.name] ? await dec(row[field.name]) : '';
        } else {
          next[field.name] = row[field.name] || '';
        }
      }
      if (active) setValues(next);
    })().catch(() => {
      if (active) setError(t('Unable to open this item.'));
    });

    return () => { active = false; };
  }, [id, cat, repo, dec]);

  if (!cat) return <p className="p-6 text-sm text-[#AEB4BE]">{t('Unknown category.')}</p>;

  const applyProvider = (providerId) => {
    const preset = getProviderPreset(providerId);
    setValues((previous) => ({
      ...previous,
      provider: providerId,
      title: previous.title || preset?.label || previous.title,
      website: previous.website || preset?.defaultWebsite || previous.website,
      applicationIdentifier: previous.applicationIdentifier || preset?.defaultPackages || previous.applicationIdentifier,
    }));
  };

  const readAvatar = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(t('Choose an image file for the local profile photo.'));
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError(t('Choose an image smaller than 750 KB.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      set('avatar', typeof reader.result === 'string' ? reader.result : '');
      setError('');
    };
    reader.onerror = () => setError(t('Could not read the selected image.'));
    reader.readAsDataURL(file);
  };

  const submit = async (event) => {
    event.preventDefault();
    const required = cat.fields.find((field) => field.required && !String(values[field.name] || '').trim());
    if (required) {
      setError(`${t(required.label)} ${t('is required.')}`);
      return;
    }

    setBusy(true);
    setError('');
    try {
      const saved = id
        ? await repo.updateItem(cat.key, id, values)
        : await repo.createItem(cat.key, values);

      // Saving in the vault succeeds even if the optional Android cache is
      // temporarily unavailable; the cache will be refreshed next time too.
      try { await syncAutofillVault(repo, dec); } catch { /* keep vault save */ }
      navigate(`/item/${cat.key}/${id || saved.id}`, { replace: true });
    } catch {
      setError(t('Unable to save this item. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pk-safe-form-page px-5 pb-28">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} aria-label={t('Back')} className="rounded-lg p-2 text-[#AEB4BE] hover:text-white">
          <ArrowLeft className={`h-5 w-5 ${language === 'ar' ? 'rotate-180' : ''}`} />
        </button>
        <h1 className="font-heading text-xl text-white">{id ? t('Edit') : t('Add')} {t(cat.label)}</h1>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {cat.fields.map((field) => (
          <div key={field.name}>
            <label htmlFor={field.name} className="text-xs uppercase tracking-widest text-[#AEB4BE]">
              {t(field.label)}{field.sensitive ? ` · ${t('encrypted')}` : ''}
            </label>

            {field.kind === 'avatar' ? (
              <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3">
                <label className="flex cursor-pointer items-center gap-3 text-sm text-[#AEB4BE]">
                  <ImagePlus className="h-5 w-5 text-[#C8A96B]" />
                  <span>{values.avatar ? t('Replace selected local photo') : t('Choose a local profile photo')}</span>
                  <input
                    id={field.name}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => readAvatar(event.target.files?.[0])}
                  />
                </label>
                <p className="mt-2 text-xs text-[#AEB4BE]/70">{t('Saved encrypted in PasKey. Photos from other apps are never read automatically.')}</p>
                {values.avatar ? (
                  <button type="button" onClick={() => set('avatar', '')} className="mt-2 text-xs text-[#C8A96B]">{t('Remove selected photo')}</button>
                ) : null}
              </div>
            ) : field.options ? (
              <select
                id={field.name}
                value={values[field.name] || ''}
                onChange={(event) => applyProvider(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#101010] px-4 py-3 text-sm text-white outline-none focus:border-[#C8A96B]"
              >
                {field.options.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
              </select>
            ) : field.multiline ? (
              <textarea
                id={field.name}
                rows={4}
                value={values[field.name] || ''}
                onChange={(event) => set(field.name, event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#C8A96B]"
              />
            ) : (
              <div className="mt-2 flex gap-2">
                <input
                  id={field.name}
                  type={field.name === 'password' ? 'password' : 'text'}
                  autoComplete="off"
                  value={values[field.name] || ''}
                  onChange={(event) => set(field.name, event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#C8A96B]"
                />
                {field.generator ? (
                  <button
                    type="button"
                    onClick={() => set(field.name, generatePassword({ length: 20 }))}
                    aria-label={t('Generate password')}
                    className="rounded-xl border border-white/10 px-3 text-[#AEB4BE] hover:border-[#C8A96B]/50 hover:text-white"
                  >
                    <Wand2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            )}
          </div>
        ))}

        <label className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-sm text-[#AEB4BE]">
          {t('Favorite')}
          <input type="checkbox" checked={!!values.favorite} onChange={(event) => set('favorite', event.target.checked)} className="h-5 w-5 accent-[#C8A96B]" />
        </label>

        {error ? <p role="alert" className="text-sm text-red-400">{error}</p> : null}

        <button type="submit" disabled={busy} className="w-full rounded-xl bg-white py-3.5 font-medium text-black active:scale-[0.98] disabled:opacity-60">
          {busy ? t('Encrypting…') : t('Save to vault')}
        </button>
      </form>
    </div>
  );
}
