import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Pencil, Star, Trash2 } from 'lucide-react';
import { getCategory } from '@/lib/categories';
import { deleteItem, getItem, toggleFavorite } from '@/lib/vaultData';
import SensitiveField from '@/components/paskey/SensitiveField';
import CopyButton from '@/components/paskey/CopyButton';
import CategoryIcon from '@/components/paskey/CategoryIcon';

export default function ItemDetail() {
  const { cat: catKey, id } = useParams();
  const cat = getCategory(catKey);
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => { if (cat) getItem(cat.key, id).then(setItem); }, [cat, id]);

  if (!cat) return <p className="p-6 text-sm text-[#AEB4BE]">Unknown category.</p>;
  if (!item) return <p className="p-6 text-sm text-[#AEB4BE]">Decrypting…</p>;

  const title = item[cat.titleField] || 'Untitled';
  const url = item.website && (item.website.startsWith('http') ? item.website : `https://${item.website}`);

  const remove = async () => {
    await deleteItem(cat.key, id);
    navigate(`/c/${cat.key}`, { replace: true });
  };

  return (
    <div className="px-5 pb-28 pt-5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="rounded-lg p-2 text-[#AEB4BE] hover:text-white"><ArrowLeft className="h-5 w-5" /></button>
        <span className="ml-auto flex gap-1">
          <button
            type="button" aria-label="Toggle favorite"
            onClick={async () => { const f = !item.favorite; await toggleFavorite(cat.key, id, f); setItem({ ...item, favorite: f }); }}
            className="rounded-lg p-2 text-[#AEB4BE] hover:text-white"
          >
            <Star className="h-5 w-5" style={item.favorite ? { color: '#C8A96B' } : undefined} />
          </button>
          <Link to={`/edit/${cat.key}/${id}`} aria-label="Edit item" className="rounded-lg p-2 text-[#AEB4BE] hover:text-white"><Pencil className="h-5 w-5" /></Link>
          <button type="button" aria-label="Delete item" onClick={() => setConfirming(true)} className="rounded-lg p-2 text-[#AEB4BE] hover:text-red-400"><Trash2 className="h-5 w-5" /></button>
        </span>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5"><CategoryIcon name={cat.icon} /></span>
        <div>
          <h1 className="font-heading text-2xl text-white">{title}</h1>
          <p className="text-xs text-[#AEB4BE]">{cat.label}{item.website ? ` · ${item.website}` : ''}</p>
        </div>
      </div>

      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-[#AEB4BE] hover:border-[#C8A96B]/50 hover:text-white">
          <ExternalLink className="h-3.5 w-3.5" /> Open website
        </a>
      )}

      <div className="mt-6">
        {cat.fields.filter((f) => f.name !== cat.titleField).map((f) => {
          if (f.sensitive) return <SensitiveField key={f.name} label={f.label} cipher={item[f.name]} />;
          const value = f.name === 'tags' ? (item.tags || []).join(', ') : item[f.name];
          if (!value) return null;
          return (
            <div key={f.name} className="border-b border-white/5 py-4">
              <p className="text-[11px] uppercase tracking-widest text-[#AEB4BE]/70">{f.label}</p>
              <p className="mt-1 break-words text-sm text-white">{value}</p>
              <div className="mt-3"><CopyButton getValue={() => value} /></div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-[10px] leading-relaxed text-[#AEB4BE]/60">
        Native build: this screen is marked FLAG_SECURE, blocking screenshots and screen recording.
      </p>

      {confirming && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 px-6">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#070707] p-6">
            <h2 className="font-heading text-lg text-white">Delete “{title}”?</h2>
            <p className="mt-2 text-sm text-[#AEB4BE]">This removes the item from your encrypted vault. It cannot be undone.</p>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setConfirming(false)} className="flex-1 rounded-xl border border-white/10 py-3 text-sm text-[#AEB4BE]">Cancel</button>
              <button type="button" onClick={remove} className="flex-1 rounded-xl bg-red-500/90 py-3 text-sm font-medium text-white">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}