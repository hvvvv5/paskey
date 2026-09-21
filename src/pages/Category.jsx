import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { getCategory } from '@/lib/categories';
import { useVault } from '@/components/paskey/VaultContext';
import ItemRow from '@/components/paskey/ItemRow';

export default function Category() {
  const { key } = useParams();
  const cat = getCategory(key);
  const { repo } = useVault();
  const [items, setItems] = useState(null);

  useEffect(() => { if (cat) repo.listCategory(cat.key).then(setItems); }, [cat, repo]);

  if (!cat) return <p className="p-6 text-sm text-[#AEB4BE]">Unknown category.</p>;

  return (
    <div className="px-5 pb-28 pt-5">
      <div className="flex items-center gap-3">
        <Link to="/" aria-label="Back to vault" className="rounded-lg p-2 text-[#AEB4BE] hover:text-white"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="font-heading text-xl text-white">{cat.label}</h1>
        <Link to={`/new/${cat.key}`} aria-label={`Add ${cat.label}`} className="ml-auto rounded-lg border border-white/10 p-2 text-[#AEB4BE] hover:border-[#C8A96B]/50 hover:text-white">
          <Plus className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-5 space-y-2">
        {items === null ? (
          <p className="py-10 text-center text-sm text-[#AEB4BE]">Decrypting…</p>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#AEB4BE]">Nothing saved here yet.</p>
        ) : items.map((i) => <ItemRow key={i.id} item={i} />)}
      </div>
    </div>
  );
}