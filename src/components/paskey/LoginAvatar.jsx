import React, { useEffect, useState } from 'react';
import { getLoginProfile } from '@/lib/loginProfiles';
import { useVault } from './VaultContext';

// Profile images are opt-in local images chosen by the user. PasKey never
// fetches social-network avatars or website favicons, so opening the vault does
// not disclose which accounts the user has to any third party.
export default function LoginAvatar({ item, className = 'h-11 w-11' }) {
  const { dec } = useVault();
  const [source, setSource] = useState('');
  const profile = getLoginProfile(item);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!item?.avatar) {
        if (active) setSource('');
        return;
      }
      try {
        const value = await dec(item.avatar);
        if (active) setSource(/^data:image\//i.test(value || '') ? value : '');
      } catch {
        if (active) setSource('');
      }
    };
    load();
    return () => { active = false; };
  }, [item?.avatar, dec]);

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl text-xs font-semibold ${className}`}
      style={{ backgroundColor: `${profile.provider.color}2B`, color: profile.provider.color }}
      aria-label={`${profile.provider.label} account`}
    >
      {source ? (
        <img src={source} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="max-w-full truncate px-1">{profile.monogram}</span>
      )}
    </span>
  );
}
