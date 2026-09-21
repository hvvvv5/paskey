import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Star } from 'lucide-react';
import CategoryIcon from './CategoryIcon';
import LoginAvatar from './LoginAvatar';
import { getCategory } from '@/lib/categories';
import { getLoginProfile, isLoginCategory } from '@/lib/loginProfiles';

export default function ItemRow({ item }) {
  const cat = getCategory(item._category);
  const login = isLoginCategory(item._category);
  const profile = login ? getLoginProfile(item) : null;
  const title = login ? profile.title : (item[cat.titleField] || 'Untitled');
  const subtitle = login
    ? (profile.identity || profile.target)
    : (item.website || item.email || item.username || item.accountHolder || item.cardholder || item.city || cat.label);

  return (
    <Link
      to={`/item/${cat.key}/${item.id}`}
      className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 transition-colors hover:border-[#C8A96B]/40"
    >
      {login ? (
        <LoginAvatar item={item} className="h-9 w-9" />
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5">
          <CategoryIcon name={cat.icon} className="h-4 w-4" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm text-white">{title}</span>
          {item.favorite ? <Star className="h-3 w-3 shrink-0" style={{ color: '#C8A96B' }} aria-label="Favorite" /> : null}
        </span>
        <span className="block truncate text-xs text-[#AEB4BE]">{subtitle}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[#AEB4BE]" aria-hidden="true" />
    </Link>
  );
}
