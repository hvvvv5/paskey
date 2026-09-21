const GENERIC_PROVIDER = {
  id: 'generic',
  label: 'Website or app',
  mark: '•',
  color: '#7C3AED',
  aliases: [],
  domains: [],
  packages: [],
};

// This is a local catalog. It never contacts these services and it does not
// download profile photos or favicons. A user can always select “Other website
// or app” and enter an exact domain or Android package for a new service.
export const LOGIN_PROVIDERS = [
  {
    id: 'google', label: 'Google', mark: 'G', color: '#4285F4',
    aliases: ['gmail', 'google mail'],
    domains: ['accounts.google.com', 'google.com', 'gmail.com'],
    packages: ['com.google.android.gms', 'com.google.android.gm'],
    defaultWebsite: 'accounts.google.com',
    defaultPackages: 'com.google.android.gms, com.google.android.gm',
  },
  {
    id: 'microsoft', label: 'Microsoft', mark: 'M', color: '#00A4EF',
    aliases: ['outlook', 'hotmail', 'live', 'office', 'microsoft 365', 'microsoft365'],
    domains: [
      'login.microsoftonline.com', 'login.live.com', 'outlook.live.com',
      'outlook.office.com', 'office.com', 'microsoft.com', 'live.com',
      'hotmail.com', 'outlook.com',
    ],
    packages: [
      'com.microsoft.office.outlook', 'com.microsoft.office.officehub',
      'com.microsoft.office.word', 'com.microsoft.office.excel',
      'com.microsoft.office.powerpoint',
    ],
    defaultWebsite: 'login.live.com',
    defaultPackages: 'com.microsoft.office.outlook',
  },
  {
    id: 'apple', label: 'Apple / iCloud', mark: 'A', color: '#D1D5DB',
    aliases: ['apple', 'icloud'],
    domains: ['appleid.apple.com', 'icloud.com', 'apple.com'],
    packages: [],
    defaultWebsite: 'appleid.apple.com',
    defaultPackages: '',
  },
  {
    id: 'yahoo', label: 'Yahoo', mark: 'Y!', color: '#720E9E',
    aliases: ['yahoo mail'],
    domains: ['yahoo.com', 'mail.yahoo.com'],
    packages: ['com.yahoo.mobile.client.android.mail'],
    defaultWebsite: 'mail.yahoo.com',
    defaultPackages: 'com.yahoo.mobile.client.android.mail',
  },
  {
    id: 'proton', label: 'Proton Mail', mark: 'P', color: '#6D4AFF',
    aliases: ['protonmail', 'proton mail'],
    domains: ['proton.me', 'protonmail.com'],
    packages: ['ch.protonmail.android'],
    defaultWebsite: 'account.proton.me',
    defaultPackages: 'ch.protonmail.android',
  },
  {
    id: 'zoho', label: 'Zoho Mail', mark: 'Z', color: '#C8202F',
    aliases: ['zoho'],
    domains: ['zoho.com', 'zoho.eu', 'zohomail.com'],
    packages: ['com.zoho.mail'],
    defaultWebsite: 'mail.zoho.com',
    defaultPackages: 'com.zoho.mail',
  },
  {
    id: 'fastmail', label: 'Fastmail', mark: 'F', color: '#1E90FF',
    aliases: ['fast mail'],
    domains: ['fastmail.com', 'fastmail.fm'],
    packages: ['com.fastmail.app'],
    defaultWebsite: 'app.fastmail.com',
    defaultPackages: 'com.fastmail.app',
  },
  {
    id: 'facebook', label: 'Facebook', mark: 'f', color: '#1877F2',
    aliases: ['fb'],
    domains: ['facebook.com', 'm.facebook.com'],
    packages: ['com.facebook.katana', 'com.facebook.lite'],
    defaultWebsite: 'facebook.com',
    defaultPackages: 'com.facebook.katana',
  },
  {
    id: 'instagram', label: 'Instagram', mark: '◎', color: '#E4405F',
    aliases: ['insta'],
    domains: ['instagram.com'],
    packages: ['com.instagram.android'],
    defaultWebsite: 'instagram.com',
    defaultPackages: 'com.instagram.android',
  },
  {
    id: 'tiktok', label: 'TikTok', mark: '♪', color: '#00F2EA',
    aliases: ['tik tok'],
    domains: ['tiktok.com'],
    packages: ['com.zhiliaoapp.musically'],
    defaultWebsite: 'tiktok.com',
    defaultPackages: 'com.zhiliaoapp.musically',
  },
  {
    id: 'x', label: 'X', mark: 'X', color: '#E7E7E7',
    aliases: ['twitter'],
    domains: ['x.com', 'twitter.com'],
    packages: ['com.twitter.android'],
    defaultWebsite: 'x.com, twitter.com',
    defaultPackages: 'com.twitter.android',
  },
  {
    id: 'reddit', label: 'Reddit', mark: 'R', color: '#FF4500',
    aliases: [],
    domains: ['reddit.com'],
    packages: ['com.reddit.frontpage'],
    defaultWebsite: 'reddit.com',
    defaultPackages: 'com.reddit.frontpage',
  },
  {
    id: 'whatsapp', label: 'WhatsApp', mark: 'W', color: '#25D366',
    aliases: ['wa'],
    domains: ['whatsapp.com', 'web.whatsapp.com'],
    packages: ['com.whatsapp', 'com.whatsapp.w4b'],
    defaultWebsite: 'web.whatsapp.com',
    defaultPackages: 'com.whatsapp',
  },
  {
    id: 'telegram', label: 'Telegram', mark: 'T', color: '#229ED9',
    aliases: [],
    domains: ['telegram.org', 'web.telegram.org'],
    packages: ['org.telegram.messenger', 'org.thunderdog.challegram'],
    defaultWebsite: 'web.telegram.org',
    defaultPackages: 'org.telegram.messenger',
  },
  {
    id: 'discord', label: 'Discord', mark: 'D', color: '#5865F2',
    aliases: [],
    domains: ['discord.com'],
    packages: ['com.discord'],
    defaultWebsite: 'discord.com',
    defaultPackages: 'com.discord',
  },
  {
    id: 'linkedin', label: 'LinkedIn', mark: 'in', color: '#0A66C2',
    aliases: [],
    domains: ['linkedin.com'],
    packages: ['com.linkedin.android'],
    defaultWebsite: 'linkedin.com',
    defaultPackages: 'com.linkedin.android',
  },
  {
    id: 'snapchat', label: 'Snapchat', mark: 'S', color: '#FFFC00',
    aliases: [],
    domains: ['snapchat.com'],
    packages: ['com.snapchat.android'],
    defaultWebsite: 'snapchat.com',
    defaultPackages: 'com.snapchat.android',
  },
  {
    id: 'pinterest', label: 'Pinterest', mark: 'P', color: '#E60023',
    aliases: [],
    domains: ['pinterest.com'],
    packages: ['com.pinterest'],
    defaultWebsite: 'pinterest.com',
    defaultPackages: 'com.pinterest',
  },
  {
    id: 'twitch', label: 'Twitch', mark: 'T', color: '#9146FF',
    aliases: [],
    domains: ['twitch.tv'],
    packages: ['tv.twitch.android.app'],
    defaultWebsite: 'twitch.tv',
    defaultPackages: 'tv.twitch.android.app',
  },
  {
    id: 'youtube', label: 'YouTube', mark: '▶', color: '#FF0000',
    aliases: [],
    domains: ['youtube.com', 'accounts.youtube.com'],
    packages: ['com.google.android.youtube'],
    defaultWebsite: 'youtube.com',
    defaultPackages: 'com.google.android.youtube',
  },
  {
    id: 'github', label: 'GitHub', mark: 'GH', color: '#E6EDF3',
    aliases: [],
    domains: ['github.com'],
    packages: ['com.github.android'],
    defaultWebsite: 'github.com',
    defaultPackages: 'com.github.android',
  },
];

export const PROVIDER_OPTIONS = [
  { value: '', label: 'Auto-detect from website or Android app' },
  ...LOGIN_PROVIDERS.map((provider) => ({ value: provider.id, label: provider.label })),
  { value: 'generic', label: 'Other website or app' },
];

const text = (value) => String(value || '').trim();
const lower = (value) => text(value).toLowerCase();

export function normalizeHost(value) {
  let host = lower(value);
  if (!host) return '';
  host = host.replace(/^[a-z][a-z\d+.-]*:\/\//i, '');
  host = host.replace(/^\/\//, '');
  host = host.split(/[/?#]/, 1)[0];
  host = host.replace(/^.*@/, '');
  host = host.replace(/^www\./, '');
  host = host.replace(/:\d+$/, '');
  return host;
}

export function splitTargets(value) {
  return String(value || '')
    .split(/[;,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function matchesHost(host, candidate) {
  const normalizedHost = normalizeHost(host);
  const normalizedCandidate = normalizeHost(candidate);
  return Boolean(normalizedHost && normalizedCandidate && (
    normalizedHost === normalizedCandidate || normalizedHost.endsWith(`.${normalizedCandidate}`)
  ));
}

function normalizeProviderId(value) {
  const candidate = lower(value);
  if (!candidate || candidate === 'generic') return '';
  return LOGIN_PROVIDERS.find((provider) => (
    provider.id === candidate
    || lower(provider.label) === candidate
    || (Array.isArray(provider.aliases) ? provider.aliases : []).includes(candidate)
  ))?.id || '';
}

export function getProviderPreset(value) {
  const id = normalizeProviderId(value) || lower(value);
  return LOGIN_PROVIDERS.find((provider) => provider.id === id) || null;
}

export function getLoginProvider(item = {}) {
  if (lower(item.provider) === 'generic') return GENERIC_PROVIDER;
  const explicit = getProviderPreset(item.provider);
  if (explicit) return explicit;

  const websites = splitTargets(item.website);
  const packages = splitTargets(item.applicationIdentifier).map(lower);
  const identities = [item.email, item.username].map(lower);

  for (const provider of LOGIN_PROVIDERS) {
    if (websites.some((website) => provider.domains.some((domain) => matchesHost(website, domain)))) return provider;
    if (packages.some((packageName) => provider.packages.includes(packageName))) return provider;
    if (identities.some((identity) => provider.domains.some((domain) => identity.endsWith(`@${domain}`)))) return provider;
  }
  return GENERIC_PROVIDER;
}

export function isLoginCategory(category) {
  return ['passwords', 'email', 'social'].includes(category);
}

export function isAutofillLogin(item = {}) {
  return isLoginCategory(item._category) && Boolean(
    item.password || item.username || item.email || item.phone
  );
}

function primaryWebsite(item) {
  return splitTargets(item.website)[0] || '';
}

function primaryPackage(item) {
  return splitTargets(item.applicationIdentifier)[0] || '';
}

function hasMeaningfulTitle(item, provider) {
  const title = text(item.title || item.bankName || item.name);
  if (!title) return false;
  const titleLower = lower(title);
  const targetHost = normalizeHost(primaryWebsite(item));
  const targetPackage = lower(primaryPackage(item));
  const knownProviderNames = [
    provider?.id,
    provider?.label,
    ...(Array.isArray(provider?.aliases) ? provider.aliases : []),
  ].map(lower);
  return !knownProviderNames.includes(titleLower)
    && titleLower !== targetHost
    && titleLower !== targetPackage;
}

function typeFor(provider, identity) {
  if (provider.id === 'whatsapp' && identity) return 'WhatsApp number';
  if (identity.includes('@')) return 'Email account';
  if (identity) return 'Username account';
  return provider.id === 'generic' ? 'Website or app login' : `${provider.label} account`;
}

export function getLoginProfile(item = {}) {
  const provider = getLoginProvider(item);
  const profileLabel = text(item.profileLabel);
  const email = text(item.email);
  const username = text(item.username);
  const phone = text(item.phone);
  const identity = email || username || phone;
  const website = primaryWebsite(item);
  const applicationIdentifier = primaryPackage(item);
  const customTitle = hasMeaningfulTitle(item, provider) ? text(item.title || item.bankName || item.name) : '';
  const targetName = normalizeHost(website) || applicationIdentifier || provider.label;

  const baseTitle = provider.id === 'generic'
    ? (profileLabel || customTitle || targetName || 'Saved login')
    : provider.label;

  // The account identity is intentionally included in the primary title for
  // known providers. Android often renders only the first line in its Autofill
  // chooser, so “Google — name@gmail.com” is unambiguous.
  let title = baseTitle;
  if (identity) title = `${baseTitle} — ${identity}`;
  else if (profileLabel && provider.id !== 'generic') title = `${baseTitle} — ${profileLabel}`;
  else if (customTitle && provider.id !== 'generic') title = `${baseTitle} — ${customTitle}`;

  const target = website
    ? `Website · ${normalizeHost(website)}`
    : applicationIdentifier
      ? `Android app · ${applicationIdentifier}`
      : 'No website or Android app linked';

  const targetKey = website
    ? `web:${normalizeHost(website)}`
    : applicationIdentifier
      ? `app:${lower(applicationIdentifier)}`
      : `provider:${provider.id}`;

  const monogram = provider.id === 'generic'
    ? (normalizeHost(website).charAt(0).toUpperCase() || applicationIdentifier.charAt(0).toUpperCase() || '•')
    : provider.mark;

  return {
    provider,
    title,
    baseTitle,
    identity,
    identityType: typeFor(provider, identity),
    target,
    targetKey,
    targetName,
    website: normalizeHost(website),
    applicationIdentifier,
    monogram,
    hasIdentity: Boolean(identity),
  };
}

export function nativeLoginPresentation(item = {}) {
  const profile = getLoginProfile(item);
  return {
    provider: profile.provider.id,
    displayTitle: profile.title,
    displaySubtitle: profile.identity ? `${profile.identity} · ${profile.target}` : profile.target,
    identity: profile.identity,
  };
}
