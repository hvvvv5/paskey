const SETS = {
  uppercase: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  lowercase: 'abcdefghijkmnopqrstuvwxyz',
  numbers: '23456789',
  symbols: '!@#$%^&*?-_=+',
};

export function generatePassword({ length = 20, uppercase = true, lowercase = true, numbers = true, symbols = true }) {
  let pool = '';
  if (uppercase) pool += SETS.uppercase;
  if (lowercase) pool += SETS.lowercase;
  if (numbers) pool += SETS.numbers;
  if (symbols) pool += SETS.symbols;
  if (!pool) pool = SETS.lowercase;
  // Cryptographically secure RNG (native build must use SecureRandom).
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  let out = '';
  for (let i = 0; i < length; i++) out += pool[bytes[i] % pool.length];
  return out;
}

export function scorePassword(pw = '') {
  if (!pw) return { score: 0, label: 'Empty' };
  let s = 0;
  s += Math.min(40, pw.length * 3);
  if (/[a-z]/.test(pw)) s += 10;
  if (/[A-Z]/.test(pw)) s += 12;
  if (/[0-9]/.test(pw)) s += 12;
  if (/[^A-Za-z0-9]/.test(pw)) s += 16;
  if (new Set(pw).size > 10) s += 10;
  if (/(.)\1{2,}/.test(pw)) s -= 12;
  if (/^[a-zA-Z]+$/.test(pw)) s -= 10;
  if (pw.length < 8) s -= 20;
  s = Math.max(0, Math.min(100, s));
  const label = s < 30 ? 'Weak' : s < 55 ? 'Fair' : s < 75 ? 'Good' : s < 90 ? 'Strong' : 'Very Strong';
  return { score: s, label };
}