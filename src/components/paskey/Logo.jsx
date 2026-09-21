import React from 'react';

// PasKey mark: shield silhouette with feline-inspired angles, a "P" bowl and a key stem.
export default function Logo({ size = 40, shimmer = false, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="PasKey logo">
      <defs>
        <linearGradient id="pk-metal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#AEB4BE" />
          <stop offset="55%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#C8A96B" />
        </linearGradient>
        <linearGradient id="pk-shine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <clipPath id="pk-clip">
          <path d="M32 3 L57 12 V32 C57 47 46 57 32 61 C18 57 7 47 7 32 V12 Z" />
        </clipPath>
      </defs>
      <path
        d="M32 3 L57 12 V32 C57 47 46 57 32 61 C18 57 7 47 7 32 V12 Z"
        fill="#070707"
        stroke="url(#pk-metal)"
        strokeWidth="2.2"
      />
      <g clipPath="url(#pk-clip)">
        <path d="M24 17 h11 a9 9 0 0 1 0 18 h-11 z" fill="none" stroke="url(#pk-metal)" strokeWidth="3.4" strokeLinejoin="round" />
        <path d="M24 17 v30" fill="none" stroke="url(#pk-metal)" strokeWidth="3.4" strokeLinecap="round" />
        <path d="M24 41 h7 M24 47 h5" stroke="#C8A96B" strokeWidth="3" strokeLinecap="round" />
        <circle cx="35" cy="26" r="3" fill="#070707" />
        {shimmer && (
          <rect x="-30" y="0" width="26" height="64" fill="url(#pk-shine)" className="pk-shimmer" />
        )}
      </g>
    </svg>
  );
}