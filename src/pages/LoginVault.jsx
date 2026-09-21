import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Globe2,
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  Smartphone,
  UserRound,
} from 'lucide-react';
import { useVault } from '@/components/paskey/VaultContext';

function loginTitle(item) {
  return item.title || item.website || item.applicationIdentifier || 'Saved login';
}

function loginIdentity(item) {
  return item.username || item.email || 'No username saved';
}

function loginTarget(item) {
  return item.website || item.applicationIdentifier || 'Local login';
}

export default function LoginVault() {
  const { repo } = useVault();
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!repo) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      setItems(await repo.listCategory('passwords'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const retryTimer = window.setTimeout(refresh, 1500);

    return () => window.clearTimeout(retryTimer);
  }, [repo]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) return items;

    return items.filter((item) => {
      const text = [
        item.title,
        item.website,
        item.applicationIdentifier,
        item.username,
        item.email,
      ].join(' ').toLowerCase();

      return text.includes(needle);
    });
  }, [items, query]);

  return (
    <div className="min-h-screen px-5 pb-10 pt-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm text-[#AEB4BE] hover:bg-white/[0.05] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Vault
        </Link>

        <Link
          to="/new/passwords"
          className="inline-flex items-center gap-2 rounded-xl bg-[#C8A96B] px-3 py-2 text-sm font-medium text-[#070707] active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Add login
        </Link>
      </div>

      <div className="mt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#C8A96B]">PasKey Vault</p>
            <h1 className="mt-2 font-heading text-3xl text-white">Login Vault</h1>
            <p className="mt-2 text-sm text-[#AEB4BE]">
              Saved sign-ins stay encrypted on this device.
            </p>
          </div>

          <button
            type="button"
            onClick={refresh}
            aria-label="Refresh saved logins"
            className="rounded-xl border border-white/10 p-3 text-[#AEB4BE] hover:border-[#C8A96B]/40 hover:text-white active:scale-95"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="relative mt-6">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#AEB4BE]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search saved logins"
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-[#AEB4BE] focus:border-[#C8A96B]/60"
          />
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-[#AEB4BE]">
          <span>{filtered.length} saved {filtered.length === 1 ? 'login' : 'logins'}</span>
          <span>Passwords hidden</span>
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-[#AEB4BE]">
              Loading saved logins...
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-center">
              <KeyRound className="mx-auto h-8 w-8 text-[#C8A96B]" />
              <p className="mt-4 text-base text-white">No saved logins yet</p>
              <p className="mt-2 text-sm text-[#AEB4BE]">
                Add one manually or save it after signing in with Autofill.
              </p>
              <Link
                to="/new/passwords"
                className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[#C8A96B]/50 px-4 py-2 text-sm text-[#C8A96B]"
              >
                <Plus className="h-4 w-4" />
                Add your first login
              </Link>
            </div>
          ) : (
            filtered.map((item) => (
              <Link
                key={item.id}
                to={`/item/passwords/${item.id}`}
                className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-[#C8A96B]/45"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-[#C8A96B]/10 p-3 text-[#C8A96B]">
                    {item.website ? <Globe2 className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-white">{loginTitle(item)}</p>
                    <p className="mt-1 truncate text-sm text-[#AEB4BE]">{loginTarget(item)}</p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-[#AEB4BE]">
                      <UserRound className="h-3.5 w-3.5" />
                      <span className="truncate">{loginIdentity(item)}</span>
                    </div>
                  </div>
                  <KeyRound className="mt-1 h-4 w-4 shrink-0 text-[#AEB4BE]" />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}