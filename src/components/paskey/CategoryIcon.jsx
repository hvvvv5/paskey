import React from 'react';
import { KeyRound, Mail, AtSign, Landmark, CreditCard, MapPin, FileLock } from 'lucide-react';

const MAP = { KeyRound, Mail, AtSign, Landmark, CreditCard, MapPin, FileLock };

export default function CategoryIcon({ name, className = 'h-5 w-5', color = '#C8A96B' }) {
  const Icon = MAP[name] || KeyRound;
  return <Icon className={className} strokeWidth={1.6} style={{ color }} aria-hidden="true" />;
}