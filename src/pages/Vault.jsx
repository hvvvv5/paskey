import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { CATEGORIES } from '@/lib/categories';
import { useVault } from '@/components/paskey/VaultContext';
import CategoryIcon from '@/components/paskey/CategoryIcon';
import ItemRow from '@/components/paskey/ItemRow';
import AddMenu from '@/components/paskey/AddMenu';
import PullToRefresh from '@/components/paskey/PullToRefresh';
import { useI18n } from '@/lib/i18n';

export default function Vault() {
  const { repo } = useVault();
  const { t } = useI18n();
  const [items, setItems] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const searchRef = useRef(null);

  const refresh = async () => { if (repo) setItems(await repo.listItems()); };

  useEffect(() => { refresh().catch(() => setItems([])); }, [repo]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('focus') === 'search') searchRef.current?.focus();
  }, []);
  useEffect(() => {
    if (query.trim() && repo) repo.searchItems(query).then(setResults).catch(() => setResults([]));
    else setResults([]);
  }, [query, repo]);

  const counts = useMemo(() => {
    const map = {};
    (items || []).forEach((item) => { map[item._category] = (map[item._category] || 0) + 1; });
    return map;
  }, [items]);

  const favorites = (items || []).filter((item) => item.favorite).slice(0, 4);
  const recent = (items || []).slice(0, 4);

  return (
    <>
      <PullToRefresh onRefresh={refresh}>
        <div className="px-5 pb-32 pt-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#C8A96B]">{t('Your private space')}</p>
              <h1 className="mt-1 font-heading text-2xl text-white">{t('Vault')}</h1>
            </div>
            <AddMenu />
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#AEB4BE]" aria-hidden="true" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('Search PasKey...')}
              aria-label={t('Search PasKey...')}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-white placeholder:text-[#AEB4BE]/70 outline-none focus:border-[#C8A96B]"
            />
          </div>

          {query.trim() ? (
            <div className="mt-5 space-y-2">
              {results.length === 0 ? <p className="py-10 text-center text-sm text-[#AEB4BE]">{t('No matching items in your vault.')}</p> : results.map((item) => <ItemRow key={`${item._category}-${item.id}`} item={item} />)}
            </div>
          ) : (
            <>
              <Link to="/security" className="mt-5 block rounded-2xl border border-[#C8A96B]/25 bg-gradient-to-br from-white/[0.06] to-transparent p-5">
                <p className="text-xs uppercase tracking-widest text-[#AEB4BE]">{t('Security')}</p>
                <p className="mt-1 font-heading text-2xl text-white">{t('Vault secured')} <span style={{ color: '#C8A96B' }}>·</span> {items ? items.length : 0} {t('items')}</p>
                <p className="mt-1 text-xs text-[#AEB4BE]">{t('Open the Security Center for your local audit score.')}</p>
              </Link>

              <div className="mt-6 grid grid-cols-2 gap-3">
                {CATEGORIES.map((category, index) => (
                  <motion.div key={category.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03, duration: 0.25 }}>
                    <Link
                      to={category.key === 'passwords' ? '/autofill' : `/c/${category.key}`}
                      className="flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-[#C8A96B]/40"
                    >
                      <CategoryIcon name={category.icon} />
                      <span className="text-sm text-white">{t(category.label)}</span>
                      <span className="text-xs text-[#AEB4BE]">{counts[category.key] || 0} items</span>
                    </Link>
                  </motion.div>
                ))}
              </div>

              {favorites.length > 0 ? (
                <section className="mt-8">
                  <h2 className="text-xs uppercase tracking-widest text-[#AEB4BE]">{t('Favorites')}</h2>
                  <div className="mt-3 space-y-2">{favorites.map((item) => <ItemRow key={`f-${item._category}-${item.id}`} item={item} />)}</div>
                </section>
              ) : null}

              {recent.length > 0 ? (
                <section className="mt-8">
                  <h2 className="text-xs uppercase tracking-widest text-[#AEB4BE]">{t('Recently updated')}</h2>
                  <div className="mt-3 space-y-2">{recent.map((item) => <ItemRow key={`r-${item._category}-${item.id}`} item={item} />)}</div>
                </section>
              ) : null}

              {items && items.length === 0 ? <p className="py-12 text-center text-sm text-[#AEB4BE]">{t('Your vault is empty. Tap + to add your first item.')}</p> : null}
            </>
          )}
        </div>
      </PullToRefresh>
    </>
  );
}
