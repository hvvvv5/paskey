import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Wand2 } from 'lucide-react';
import { getCategory } from '@/lib/categories';
import { getItem, saveItem } from '@/lib/vaultData';
import { useVault } from '@/components/paskey/VaultContext';
import { generatePassword } from '@/lib/password';

export default function ItemForm() {
  const { cat: catKey, id } = useParams();
  const cat = getCategory(catKey);
  const { enc, dec } = useVault();
  const navigate = useNavigate();
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id || !cat) return;
    (async () => {
      const row = await getItem(cat.key, id);
      const next = { favorite: !!row.favorite };
      for (const f of cat.fields) {
        if (f.name === 'tags') next.tags = (row.tags || []).join(', ');
        else next[f.name] = f.sensitive ? await dec(row[f.name]) : row[f.name] || '';
      }
      setValues(next);
    })();
  }, [id, cat, dec]);

  if (!cat) return <p className="p-6 text-sm text-[#AEB4BE]">Unknown category.</p>;

  const submit = async (e) => {
    e.preventDefault();
    const req = cat.fields.find((f) => f.required && !String(values[f.name] || '').trim());
    if (req) return setError(`${req.label} is required.`);
    setBusy(true);
    setError('');
    try {
      const saved = await saveItem(cat.key, id, values, enc);
      navigate(`/item/${cat.key}/${id || saved.id}`, { replace: true });
    } catch {
      setError('Unable to save this item. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const set = (name, v) => setValues((prev) => ({ ...prev, [name]: v }));

  return (
    <div className="px-5 pb-28 pt-5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="rounded-lg p-2 text-[#AEB4BE] hover:text-white"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="font-heading text-xl text-white">{id ? 'Edit' : 'New'} {cat.label}</h1>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {cat.fields.map((f) => (
          <div key={f.name}>
            <label htmlFor={f.name} className="text-xs uppercase tracking-widest text-[#AEB4BE]">
              {f.label}{f.sensitive ? ' · encrypted' : ''}
            </label>
            {f.multiline ? (
              <textarea
                id={f.name} rows={4} value={values[f.name] || ''} onChange={(e) => set(f.name, e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#C8A96B]"
              />
            ) : (
              <div className="mt-2 flex gap-2">
                <input
                  id={f.name} type="text" autoComplete="off" value={values[f.name] || ''} onChange={(e) => set(f.name, e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#C8A96B]"
                />
                {f.generator && (
                  <button
                    type="button" onClick={() => set(f.name, generatePassword({ length: 20 }))} aria-label="Generate password"
                    className="rounded-xl border border-white/10 px-3 text-[#AEB4BE] hover:border-[#C8A96B]/50 hover:text-white"
                  >
                    <Wand2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        <label className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-sm text-[#AEB4BE]">
          Favorite
          <input type="checkbox" checked={!!values.favorite} onChange={(e) => set('favorite', e.target.checked)} className="h-5 w-5 accent-[#C8A96B]" />
        </label>

        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

        <button type="submit" disabled={busy} className="w-full rounded-xl bg-white py-3.5 font-medium text-black active:scale-[0.98] disabled:opacity-60">
          {busy ? 'Encrypting…' : 'Save to vault'}
        </button>
      </form>
    </div>
  );
}