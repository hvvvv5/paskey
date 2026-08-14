import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { CATEGORIES, getCategory } from '@/lib/categories';
import { listAll } from '@/lib/vaultData';
import CategoryIcon from '@/components/paskey/CategoryIcon';
import ItemRow from '@/components/paskey/ItemRow';
import AddMenu from '@/components/paskey/AddMenu';
import PullToRefresh from '@/components/paskey/PullToRefresh';

export default function Vault() {
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => { listAll().then(setItems); }, []);
  const refresh = async () => { setItems(await listAll()); };

  const counts = useMemo(() => {
    const map = {};
    (items || []).forEach((i) => { map[i._category] = (map[i._category] || 0) + 1; });
    return map;
  }, [items]);

  const results = useMemo(() => {
    if (!q.trim() || !items) return [];
    const t = q.toLowerCase();
    return items.filter((i) => {
      const cat = getCategory(i._category);
      const hay = [i[cat.titleField], i.website, i.username, i.email, i.applicationIdentifier, cat.label, (i.tags || []).join(' ')]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(t);
    });
  }, [q, items]);

  const favorites = (items || []).filter((i) => i.favorite).slice(0, 4);
  const recent = (items || []).slice(0, 4);

  return (
    <>
    <PullToRefresh onRefresh={refresh}>
    <div className="px-5 pb-28 pt-5">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#AEB4BE]" aria-hidden="true" />
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search PasKey..." aria-label="Search PasKey"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-white placeholder:text-[#AEB4BE]/70 outline-none focus:border-[#C8A96B]"
        />
      </div>

      {q.trim() ? (
        <div className="mt-5 space-y-2">
          {results.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#AEB4BE]">No matching items in your vault.</p>
          ) : results.map((i) => <ItemRow key={`${i._category}-${i.id}`} item={i} />)}
        </div>
      ) : (
        <>
          <Link to="/security" className="mt-5 block rounded-2xl border border-[#C8A96B]/25 bg-gradient-to-br from-white/[0.06] to-transparent p-5">
            <p className="text-xs uppercase tracking-widest text-[#AEB4BE]">Security</p>
            <p className="mt-1 font-heading text-2xl text-white">
              Vault secured <span style={{ color: '#C8A96B' }}>·</span> {items ? items.length : 0} items
            </p>
            <p className="mt-1 text-xs text-[#AEB4BE]">Open the Security Center for your local audit score.</p>
          </Link>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {CATEGORIES.map((c, idx) => (
              <motion.div key={c.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03, duration: 0.25 }}>
                <Link
                  to={`/c/${c.key}`}
                  className="flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-[#C8A96B]/40"
                >
                  <CategoryIcon name={c.icon} />
                  <span className="text-sm text-white">{c.label}</span>
                  <span className="text-xs text-[#AEB4BE]">{counts[c.key] || 0} items</span>
                </Link>
              </motion.div>
            ))}
          </div>

          {favorites.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xs uppercase tracking-widest text-[#AEB4BE]">Favorites</h2>
              <div className="mt-3 space-y-2">{favorites.map((i) => <ItemRow key={`f-${i._category}-${i.id}`} item={i} />)}</div>
            </section>
          )}

          {recent.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xs uppercase tracking-widest text-[#AEB4BE]">Recently updated</h2>
              <div className="mt-3 space-y-2">{recent.map((i) => <ItemRow key={`r-${i._category}-${i.id}`} item={i} />)}</div>
            </section>
          )}

          {items && items.length === 0 && (
            <p className="py-12 text-center text-sm text-[#AEB4BE]">Your vault is empty. Tap + to add your first item.</p>
          )}
        </>
      )}
    </div>
    </PullToRefresh>
    <AddMenu />
    </>
  );
}