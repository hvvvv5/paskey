const text = (value) => String(value || '').trim();

export function normalizeAutofillHost(value) {
  let host = text(value).toLowerCase();
  if (!host) return '';
  host = host.replace(/^[a-z][a-z\d+.-]*:\/\//i, '');
  host = host.replace(/^\/\//, '');
  host = host.split(/[/?#]/, 1)[0];
  host = host.replace(/^.*@/, '');
  host = host.replace(/^www\./, '');
  host = host.replace(/:\d+$/, '');
  return host;
}

export function autofillIdentity(record = {}) {
  const email = text(record.email);
  const phone = text(record.phone);
  const username = text(record.username);
  if (email) return { type: 'email', value: email };
  if (phone) return { type: 'phone', value: phone };
  if (username) return { type: 'username', value: username };
  return { type: '', value: '' };
}

export function autofillTarget(record = {}) {
  const website = normalizeAutofillHost(record.website);
  const applicationIdentifier = text(record.applicationIdentifier);
  if (website) return { type: 'website', value: website };
  if (applicationIdentifier) return { type: 'android', value: applicationIdentifier };
  return { type: '', value: '' };
}

export function isCompleteAutofillLogin(record = {}, plaintextPassword) {
  const password = plaintextPassword === undefined ? record.password : plaintextPassword;
  return Boolean(
    autofillIdentity(record).value
    && text(password)
    && autofillTarget(record).value
  );
}

function serviceName(record, target) {
  const provider = text(record.provider).toLowerCase();
  const known = {
    google: 'Google',
    instagram: 'Instagram',
    whatsapp: 'WhatsApp',
  };
  if (known[provider]) return known[provider];
  if (target.value === 'accounts.google.com') return 'Google';
  if (target.value === 'com.instagram.android') return 'Instagram';
  if (target.value === 'com.whatsapp') return 'WhatsApp';
  return target.type === 'website' ? 'Website' : 'Android app';
}

export function buildAutofillTitle(record = {}) {
  const identity = autofillIdentity(record).value;
  const target = autofillTarget(record);
  const service = serviceName(record, target);
  return identity ? `${service} — ${identity}` : service;
}

export function normalizeAutofillRecord(record = {}) {
  const target = autofillTarget(record);
  return {
    title: buildAutofillTitle(record),
    website: target.type === 'website' ? target.value : '',
    applicationIdentifier: target.type === 'android' ? target.value : '',
    username: text(record.username),
    email: text(record.email),
    phone: text(record.phone),
    password: record.password || '',
    image: record.image || record.avatar || '',
    _paskeyPendingId: text(record._paskeyPendingId || record.pendingId),
  };
}

export function matchesAutofillAccount(record = {}, candidate = {}) {
  const currentIdentity = autofillIdentity(record).value.toLowerCase();
  const candidateIdentity = autofillIdentity(candidate).value.toLowerCase();
  if (!currentIdentity || currentIdentity !== candidateIdentity) return false;
  const currentTarget = autofillTarget(record);
  const candidateTarget = autofillTarget(candidate);
  return Boolean(
    currentTarget.type
    && currentTarget.type === candidateTarget.type
    && currentTarget.value === candidateTarget.value
  );
}
