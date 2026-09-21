import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

// PasKey Master Password recovery service.
//
// Architecture: the vault encryption key K is a random data key (never derived
// from the master password). K is wrapped with a master-password KEK and with a
// recovery key R. R is stored here, encrypted with a server secret, and is only
// released to the authenticated owner after a verified email code. The client
// then unwraps K using R + the locally-stored wrapped key, and re-wraps K with a
// new master-password KEK. K never changes, so vault data is never re-encrypted
// and the old master password is never recovered.

const te = new TextEncoder();
const td = new TextDecoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function sha256hex(s) {
  const d = await crypto.subtle.digest('SHA-256', te.encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function serverKey() {
  const secret = secrets.get('PASKEY_RECOVERY_SECRET');
  if (!secret) throw new Error('Recovery secret not configured.');
  const base = await crypto.subtle.importKey('raw', te.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: te.encode('paskey-recovery-server-v1'), iterations: 100000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encStr(key, str) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(str));
  return `v1.${b64(iv)}.${b64(ct)}`;
}
async function decStr(key, payload) {
  const [, ivb, ctb] = payload.split('.');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(ivb) }, key, unb64(ctb));
  return td.decode(pt);
}

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

const codeBody = (code) =>
  `Your PasKey verification code is ${code}.\n\nIt expires in 10 minutes. If you did not request this code, you can ignore this email.\n\nNever share this code with anyone. PasKey will never ask for it.`;

async function issueCode(svc, cfg, email) {
  const now = Date.now();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  const codeHash = await sha256hex(salt + ':' + code);
  const patch = {
    codeSalt: salt,
    codeHash,
    codeExpiresAt: new Date(now + CODE_TTL_MS).toISOString(),
    attempts: 0,
    lastSentAt: new Date(now).toISOString(),
  };
  await svc.entities.RecoveryConfig.update(cfg.id, patch);
  await svc.integrations.Core.SendEmail({ to: email, subject: 'Your PasKey recovery code', body: codeBody(code) });
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const svc = base44.asServiceRole;

    const list = await svc.entities.RecoveryConfig.filter({ userId: user.id });
    const cfg = list && list.length ? list[0] : null;
    const normEmail = (e) => String(e || '').trim().toLowerCase();

    if (action === 'status') {
      return Response.json({ ok: true, hasRecovery: !!(cfg && cfg.confirmed) });
    }

    if (action === 'initRecovery') {
      const email = normEmail(body.email);
      const recoveryKey = String(body.recoveryKey || '');
      if (!email || !recoveryKey) return Response.json({ error: 'Missing fields.' }, { status: 400 });
      const sk = await serverKey();
      const cipher = await encStr(sk, recoveryKey);
      const now = Date.now();
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
      const codeHash = await sha256hex(salt + ':' + code);
      const data = {
        userId: user.id,
        emailHash: await sha256hex('pk:' + email),
        recoveryKeyCipher: cipher,
        confirmed: false,
        codeSalt: salt,
        codeHash,
        codeExpiresAt: new Date(now + CODE_TTL_MS).toISOString(),
        attempts: 0,
        lastSentAt: new Date(now).toISOString(),
        maxAttempts: MAX_ATTEMPTS,
      };
      if (cfg) await svc.entities.RecoveryConfig.update(cfg.id, data);
      else await svc.entities.RecoveryConfig.create(data);
      await svc.integrations.Core.SendEmail({ to: email, subject: 'Your PasKey recovery code', body: codeBody(code) });
      return Response.json({ ok: true, cooldownMs: RESEND_COOLDOWN_MS });
    }

    if (action === 'sendCode') {
      const email = normEmail(body.email);
      if (!email) return Response.json({ error: 'Missing email.' }, { status: 400 });
      // Never reveal whether an unrelated email is associated.
      if (!cfg || cfg.emailHash !== await sha256hex('pk:' + email)) {
        return Response.json({ ok: true, sent: true, cooldownMs: RESEND_COOLDOWN_MS });
      }
      const now = Date.now();
      if (cfg.lastSentAt && now - new Date(cfg.lastSentAt).getTime() < RESEND_COOLDOWN_MS) {
        return Response.json({ ok: false, error: 'Please wait a moment before requesting another code.', cooldownMs: RESEND_COOLDOWN_MS }, { status: 429 });
      }
      await issueCode(svc, cfg, email);
      return Response.json({ ok: true, sent: true, cooldownMs: RESEND_COOLDOWN_MS });
    }

    if (action === 'confirmRecovery') {
      const email = normEmail(body.email);
      const code = String(body.code || '').trim();
      if (!cfg || !code || cfg.emailHash !== await sha256hex('pk:' + email)) {
        return Response.json({ ok: false, error: 'Invalid or expired code.' }, { status: 400 });
      }
      const now = Date.now();
      if (!cfg.codeHash || !cfg.codeExpiresAt || now > new Date(cfg.codeExpiresAt).getTime()) {
        return Response.json({ ok: false, error: 'Code expired. Request a new one.' }, { status: 400 });
      }
      if ((cfg.attempts || 0) >= MAX_ATTEMPTS) {
        return Response.json({ ok: false, error: 'Too many attempts. Request a new code.' }, { status: 429 });
      }
      if ((await sha256hex(cfg.codeSalt + ':' + code)) !== cfg.codeHash) {
        await svc.entities.RecoveryConfig.update(cfg.id, { attempts: (cfg.attempts || 0) + 1 });
        return Response.json({ ok: false, error: 'Invalid code.' }, { status: 400 });
      }
      await svc.entities.RecoveryConfig.update(cfg.id, { confirmed: true, codeHash: '', codeSalt: '', codeExpiresAt: '', attempts: 0 });
      return Response.json({ ok: true });
    }

    if (action === 'recoverVerifyCode') {
      const email = normEmail(body.email);
      const code = String(body.code || '').trim();
      if (!cfg || !code || cfg.emailHash !== await sha256hex('pk:' + email) || !cfg.confirmed) {
        return Response.json({ ok: false, error: 'Invalid or expired code.' }, { status: 400 });
      }
      const now = Date.now();
      if (!cfg.codeHash || !cfg.codeExpiresAt || now > new Date(cfg.codeExpiresAt).getTime()) {
        return Response.json({ ok: false, error: 'Code expired. Request a new one.' }, { status: 400 });
      }
      if ((cfg.attempts || 0) >= MAX_ATTEMPTS) {
        return Response.json({ ok: false, error: 'Too many attempts. Request a new code.' }, { status: 429 });
      }
      if ((await sha256hex(cfg.codeSalt + ':' + code)) !== cfg.codeHash) {
        await svc.entities.RecoveryConfig.update(cfg.id, { attempts: (cfg.attempts || 0) + 1 });
        return Response.json({ ok: false, error: 'Invalid code.' }, { status: 400 });
      }
      const sk = await serverKey();
      const recoveryKey = await decStr(sk, cfg.recoveryKeyCipher);
      await svc.entities.RecoveryConfig.update(cfg.id, { codeHash: '', codeSalt: '', codeExpiresAt: '', attempts: 0 });
      return Response.json({ ok: true, recoveryKey });
    }

    if (action === 'disable') {
      if (cfg) await svc.entities.RecoveryConfig.delete(cfg.id);
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}