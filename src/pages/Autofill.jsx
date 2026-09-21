// This page consumes dynamic vault rows whose shape is category-dependent.
// Runtime validation is performed by isAutofillLogin/normalizeAutofillRecord.
// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Download,
  ImagePlus,
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import { useVault } from '@/components/paskey/VaultContext';
import LoginAvatar from '@/components/paskey/LoginAvatar';
import Logo from '@/components/paskey/Logo';
import { useI18n } from '@/lib/i18n';
import { getLoginProfile, isAutofillLogin } from '@/lib/loginProfiles';
import { importAndSyncAutofillVault, syncAutofillVault } from '@/lib/native/syncAutofillVault';
import { getAutofillStatus, openChromeAutofillSettings, requestEnableAutofill } from '@/lib/native/PasKeySecurity';
import {
  isCompleteAutofillLogin,
  normalizeAutofillRecord,
} from '@/lib/autofillModel';

const MAX_AVATAR_BYTES = 750 * 1024;

function ManualLoginForm({ repo, dec, onClose, onSaved }) {
  const { t } = useI18n();
  const [values, setValues] = useState({
    identityType: 'email',
    identity: '',
    password: '',
    targetType: 'website',
    target: '',
    image: '',
  });
  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const set = (name, value) => setValues((previous) => ({ ...previous, [name]: value }));
  const markTouched = (name) => setTouched((previous) => ({ ...previous, [name]: true }));
  const missingIdentity = !values.identity.trim();
  const missingPassword = !values.password.trim();
  const missingTarget = !values.target.trim();
  const valid = !missingIdentity && !missingPassword && !missingTarget;

  const readImage = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError(t('Choose an image file for the local profile photo.'));
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setFormError(t('Choose an image smaller than 750 KB.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      set('image', typeof reader.result === 'string' ? reader.result : '');
      setFormError('');
    };
    reader.onerror = () => setFormError(t('Could not read the selected image.'));
    reader.readAsDataURL(file);
  };

  const submit = async (event) => {
    event.preventDefault();
    setTouched({ identity: true, password: true, target: true });
    if (!valid || saving || !repo) return;

    setSaving(true);
    setFormError('');
    try {
      const draft = {
        email: values.identityType === 'email' ? values.identity.trim() : '',
        username: values.identityType === 'username' ? values.identity.trim() : '',
        phone: values.identityType === 'phone' ? values.identity.trim() : '',
        password: values.password,
        website: values.targetType === 'website' ? values.target : '',
        applicationIdentifier: values.targetType === 'android' ? values.target.trim() : '',
        image: values.image,
      };
      const normalized = normalizeAutofillRecord(draft);
      if (!isCompleteAutofillLogin(normalized)) {
        setFormError(t('Identity, password, and an exact website or Android package are required.'));
        return;
      }
      await repo.createItem('passwords', {
        title: normalized.title,
        website: normalized.website,
        applicationIdentifier: normalized.applicationIdentifier,
        username: normalized.username,
        email: normalized.email,
        phone: normalized.phone,
        password: normalized.password,
        avatar: normalized.image,
      });
      try { await syncAutofillVault(repo, dec); } catch { /* the encrypted vault save remains valid */ }
      await onSaved();
      onClose();
    } catch {
      setFormError(t('Could not save this login. Your entries were kept; please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-[#C8A96B]/35 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-medium text-white">{t('Add Autofill login')}</h2>
          <p className="mt-1 text-xs text-[#AEB4BE]">{t('Link one permanent login to one exact website or Android app.')}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={t('Close login form')} className="rounded-lg p-2 text-[#AEB4BE] hover:text-white"><X className="h-4 w-4" /></button>
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <div className="grid grid-cols-[8.5rem_1fr] gap-3">
          <div>
            <label htmlFor="autofill-identity-type" className="text-xs uppercase tracking-widest text-[#AEB4BE]">{t('Identity type')}</label>
            <select id="autofill-identity-type" value={values.identityType} onChange={(event) => set('identityType', event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#101010] px-3 py-3 text-sm text-white">
              <option value="email">{t('Email')}</option>
              <option value="username">{t('Username')}</option>
              <option value="phone">{t('Phone')}</option>
            </select>
          </div>
          <div>
            <label htmlFor="autofill-identity" className="text-xs uppercase tracking-widest text-[#AEB4BE]">{t('Identity')}</label>
            <input id="autofill-identity" value={values.identity} onChange={(event) => set('identity', event.target.value)} onBlur={() => markTouched('identity')} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#C8A96B]" />
            {touched.identity && missingIdentity ? <p className="mt-1 text-xs text-red-400">{t('Enter an email, username, or phone number.')}</p> : null}
          </div>
        </div>

        <div>
          <label htmlFor="autofill-password" className="text-xs uppercase tracking-widest text-[#AEB4BE]">{t('Password')}</label>
          <input id="autofill-password" type="password" autoComplete="new-password" value={values.password} onChange={(event) => set('password', event.target.value)} onBlur={() => markTouched('password')} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#C8A96B]" />
          {touched.password && missingPassword ? <p className="mt-1 text-xs text-red-400">{t('Enter a permanent password or login code.')}</p> : null}
        </div>

        <div className="grid grid-cols-[8.5rem_1fr] gap-3">
          <div>
            <label htmlFor="autofill-target-type" className="text-xs uppercase tracking-widest text-[#AEB4BE]">{t('Target type')}</label>
            <select id="autofill-target-type" value={values.targetType} onChange={(event) => set('targetType', event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#101010] px-3 py-3 text-sm text-white">
              <option value="website">{t('Website')}</option>
              <option value="android">{t('Android app')}</option>
            </select>
          </div>
          <div>
            <label htmlFor="autofill-target" className="text-xs uppercase tracking-widest text-[#AEB4BE]">{values.targetType === 'website' ? t('Domain') : t('Package name')}</label>
            <input id="autofill-target" value={values.target} onChange={(event) => set('target', event.target.value)} onBlur={() => markTouched('target')} placeholder={values.targetType === 'website' ? 'accounts.google.com' : 'com.instagram.android'} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-[#AEB4BE]/60 focus:border-[#C8A96B]" />
            {touched.target && missingTarget ? <p className="mt-1 text-xs text-red-400">{t('Enter an exact domain or Android package.')}</p> : null}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <label className="flex cursor-pointer items-center gap-3 text-sm text-[#AEB4BE]">
            <ImagePlus className="h-5 w-5 text-[#C8A96B]" />
            <span>{values.image ? t('Replace selected local photo') : t('Choose a local profile photo (optional)')}</span>
            <input type="file" accept="image/*" className="sr-only" onChange={(event) => readImage(event.target.files?.[0])} />
          </label>
          {values.image ? <button type="button" onClick={() => set('image', '')} className="mt-2 text-xs text-[#C8A96B]">{t('Remove selected photo')}</button> : null}
        </div>

        {formError ? <p role="alert" className="text-sm text-red-400">{formError}</p> : null}
        <button type="submit" disabled={!valid || saving} className="w-full rounded-xl bg-[#C8A96B] py-3.5 font-medium text-[#070707] disabled:cursor-not-allowed disabled:opacity-45">
          {saving ? t('Saving…') : t('Save login')}
        </button>
      </form>
    </section>
  );
}

function decorate(items) {
  const profiles = items.map((item) => ({ item, profile: getLoginProfile(item) }));
  const totals = new Map();
  profiles.forEach(({ profile }) => {
    totals.set(profile.targetKey, (totals.get(profile.targetKey) || 0) + 1);
  });
  const positions = new Map();

  return profiles.map((entry) => {
    const total = totals.get(entry.profile.targetKey) || 1;
    const position = (positions.get(entry.profile.targetKey) || 0) + 1;
    positions.set(entry.profile.targetKey, position);
    const numberWebsite = entry.profile.provider.id === 'generic' && total > 1;
    const numberUnknownKnownAccount = entry.profile.provider.id !== 'generic' && !entry.profile.identity && total > 1;
    const visibleTitle = numberWebsite || numberUnknownKnownAccount
      ? `${entry.profile.baseTitle} #${position}`
      : entry.profile.title;
    return { ...entry, visibleTitle };
  });
}

export default function Autofill() {
  const { repo, dec } = useVault();
  const { t, language } = useI18n();
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [autofillStatus, setAutofillStatus] = useState({ supported: true, enabled: null });
  const [openingAutofillSettings, setOpeningAutofillSettings] = useState(false);

  const refresh = useCallback(async () => {
    if (!repo) {
      setItems([]);
      setLoading(false);
      return;
    }
    const all = await repo.listItems();
    setItems(all.filter(isAutofillLogin));
    setLoading(false);
  }, [repo]);

  useEffect(() => {
    setLoading(true);
    refresh().catch(() => {
      setItems([]);
      setLoading(false);
    });
  }, [refresh]);

  useEffect(() => {
    let active = true;
    const readStatus = async () => {
      const status = await getAutofillStatus();
      if (active) setAutofillStatus(status);
    };
    readStatus();

    const onFocus = () => { readStatus(); };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') readStatus();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active = false;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const enableAutofill = async () => {
    if (openingAutofillSettings) return;
    setOpeningAutofillSettings(true);
    setError('');
    try {
      await requestEnableAutofill();
      setNotice(t('Choose PasKey as your Android Autofill service, then return here.'));
    } catch {
      setError(t('Could not open Android Autofill settings.'));
    } finally {
      setOpeningAutofillSettings(false);
    }
  };

  const openChromeSettings = async () => {
    setError('');
    try {
      await openChromeAutofillSettings();
      setNotice(t('In Chrome, enable Autofill using another service, then return to your login page.'));
    } catch {
      setError(t('Could not open Chrome Autofill settings.'));
    }
  };

  const importSavedLogins = async () => {
    if (!repo || importing) return;
    setImporting(true);
    setError('');
    setNotice('');
    try {
      const { imported, deduplicated } = await importAndSyncAutofillVault(repo, dec);
      await refresh();
      if (imported > 0) {
        setNotice(language === 'ar'
          ? `تمت إضافة ${imported} من بيانات الدخول إلى PasKey.${deduplicated ? ` وتمت إزالة ${deduplicated} من السجلات المكررة.` : ''}`
          : `${imported} saved ${imported === 1 ? 'login was' : 'logins were'} added to PasKey.${deduplicated ? ` ${deduplicated} duplicate record was removed.` : ''}`);
      } else {
        setNotice(t('No new Android saves were waiting to import.'));
      }
    } catch {
      setError(t('Could not import saved logins. Your existing vault data is unchanged; please try again.'));
    } finally {
      setImporting(false);
    }
  };

  const decorated = useMemo(() => decorate(items), [items]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return decorated;
    return decorated.filter(({ item, profile, visibleTitle }) => (
      [visibleTitle, profile.provider.label, profile.identityType, profile.identity,
        profile.target, item.website, item.applicationIdentifier, item.username,
        item.email, item.phone, item.profileLabel]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle)
    ));
  }, [decorated, query]);

  return (
    <div className="px-5 pb-32 pt-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[#C8A96B]">{t('PasKey Autofill')}</p>
          <h1 className="mt-2 font-heading text-3xl text-white">{t('Saved Logins')}</h1>
          <p className="mt-2 text-sm text-[#AEB4BE]">{t('Store and manage sign-ins for websites and Android apps.')}</p>
        </div>
        <button type="button" onClick={() => setAddOpen(true)} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[#C8A96B] px-4 text-sm font-medium text-[#070707] shadow-lg shadow-black/30 active:scale-95">
          <Plus className="h-4 w-4" /> {t('Save')}
        </button>
      </div>

      {addOpen ? <ManualLoginForm repo={repo} dec={dec} onClose={() => setAddOpen(false)} onSaved={refresh} /> : null}

      {autofillStatus.enabled === false ? (
        <section className="mt-6 rounded-2xl border border-[#C8A96B]/35 bg-[#C8A96B]/5 p-4">
          <p className="font-medium text-white">{t('Android Autofill is not enabled for PasKey')}</p>
          <p className="mt-1 text-sm text-[#AEB4BE]">{t('Enable PasKey once in Android settings so save and login suggestions can appear in apps and websites.')}</p>
          <button
            type="button"
            onClick={enableAutofill}
            disabled={openingAutofillSettings}
            className="mt-4 w-full rounded-xl bg-[#C8A96B] px-4 py-3 text-sm font-medium text-[#070707] disabled:opacity-60"
          >
            {openingAutofillSettings ? t('Opening Android settings…') : t('Enable PasKey Autofill')}
          </button>
        </section>
      ) : null}

      <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="font-medium text-white">{t('Using PasKey in Chrome?')}</p>
        <p className="mt-1 text-sm text-[#AEB4BE]">{t('Chrome must allow Autofill using another service before PasKey can save or suggest website logins.')}</p>
        <button
          type="button"
          onClick={openChromeSettings}
          className="mt-3 w-full rounded-xl border border-[#C8A96B]/45 px-4 py-3 text-sm font-medium text-[#C8A96B]"
        >
          {t('Open Chrome Autofill settings')}
        </button>
      </section>

      <section className="mt-6 rounded-2xl border border-[#C8A96B]/30 bg-gradient-to-br from-[#C8A96B]/10 to-white/[0.03] p-4">
        <div className="flex gap-3">
          <div className="pk-logo-badge flex h-12 w-12 shrink-0 items-center justify-center rounded-full" aria-hidden="true"><Logo size={34} /></div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-white">{t('Autofill save is ready')}</p>
            <p className="mt-1 text-sm text-[#AEB4BE]">{t("After a supported login, approve Android's save prompt. PasKey can offer it immediately; import only adds it to your main vault.")}</p>
          </div>
        </div>
        <button type="button" onClick={importSavedLogins} disabled={importing} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#C8A96B]/50 px-4 py-3 text-sm font-medium text-[#C8A96B] disabled:opacity-60">
          {importing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {importing ? t('Importing saved logins…') : t('Import saved login')}
        </button>
      </section>

      <div className="relative mt-6">
        <Search className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[#AEB4BE] ${language === 'ar' ? 'right-4' : 'left-4'}`} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Search saved logins')} className={`w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 ${language === 'ar' ? 'pr-11 pl-4' : 'pl-11 pr-4'} text-sm text-white outline-none placeholder:text-[#AEB4BE] focus:border-[#C8A96B]/60`} />
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-[#AEB4BE]">
        <span>{language === 'ar' ? `${filtered.length} ${t('saved logins')}` : `${filtered.length} saved ${filtered.length === 1 ? 'login' : 'logins'}`}</span>
        <span>{t('Passwords hidden')}</span>
      </div>

      {notice ? <p role="status" className="pk-status pk-status-success mt-4 rounded-xl border p-3 text-sm">{notice}</p> : null}
      {error ? <p role="alert" className="pk-status pk-status-error mt-4 rounded-xl border p-3 text-sm">{error}</p> : null}

      <div className="mt-4 space-y-3">
        {!loading && filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-center">
            <KeyRound className="mx-auto h-8 w-8 text-[#C8A96B]" />
            <p className="mt-4 text-base text-white">{t('No saved logins yet')}</p>
            <p className="mt-2 text-sm text-[#AEB4BE]">{t("Save one manually, or approve Android's Autofill save prompt after signing in.")}</p>
            <button type="button" onClick={() => setAddOpen(true)} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[#C8A96B]/50 px-4 py-2 text-sm text-[#C8A96B]"><Plus className="h-4 w-4" />{t('Save a login')}</button>
          </div>
        ) : (
          filtered.map(({ item, profile, visibleTitle }) => {
            const ready = isCompleteAutofillLogin(item);
            const targetBadge = profile.website ? t('Website') : profile.applicationIdentifier ? t('Android app') : t('Needs identity and target');
            return (
            <Link key={`${item._category}-${item.id}`} to={`/item/${item._category}/${item.id}`} className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-[#C8A96B]/45">
              <div className="flex items-start gap-3">
                <LoginAvatar item={item} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{visibleTitle}</p>
                  <p className="mt-1 truncate text-sm text-[#AEB4BE]">{profile.target}</p>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#AEB4BE]">
                    <span className="inline-flex min-w-0 items-center gap-2"><UserRound className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{profile.identity || t('No email, username, or phone saved')}</span></span>
                    <span className={`shrink-0 rounded-full border px-2 py-1 ${ready ? 'border-[#C8A96B]/40 text-[#C8A96B]' : 'border-red-400/40 text-red-300'}`}>{targetBadge}</span>
                  </div>
                </div>
                <KeyRound className="mt-1 h-4 w-4 shrink-0 text-[#AEB4BE]" />
              </div>
            </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
