import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { ArrowLeft, Mail, Lock, Loader2, ChevronRight } from 'lucide-react';
import Logo from '@/components/paskey/Logo';
import GoogleIcon from '@/components/GoogleIcon';
import { toast } from '@/components/ui/use-toast';
import { safeReturnTo } from '@/lib/authReturnTo';

// A throwaway application password is generated for new email users only to
// satisfy Base44's native register() — the user never sees or types it. The
// credential that actually matters is the separate PasKey Master Password.
function hiddenPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('') + 'Pk1!';
}

export default function AuthEntry() {
  const returnTo = safeReturnTo();
  const [mode, setMode] = useState('email'); // 'email' | 'otp' | 'password'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const go = (path) => { window.location.href = path; };
  const handleGoogle = () => base44.auth.loginWithProvider('google', returnTo);

  const continueEmail = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) return setError('Enter your email address.');
    setLoading(true);
    try {
      // New user → platform issues an OTP. Returning user → "already exists".
      await base44.auth.register({ email: email.trim(), password: hiddenPassword() });
      setLoading(false);
      setMode('otp');
    } catch (err) {
      setLoading(false);
      const msg = err?.response?.data?.detail || err?.message || '';
      if (/already exists/i.test(String(msg))) {
        setMode('password');
      } else {
        setError(msg || 'Something went wrong. Please try again.');
      }
    }
  };

  const verifyOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await base44.auth.verifyOtp({ email: email.trim(), otpCode: otp });
      if (res?.access_token) base44.auth.setToken(res.access_token);
      go(returnTo);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setError('');
    try {
      await base44.auth.resendOtp(email.trim());
      toast({ title: 'Code sent', description: 'Check your email for the new code.' });
      setCooldown(30);
      const t = setInterval(() => setCooldown((c) => { if (c <= 1) clearInterval(t); return c - 1; }), 1000);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to resend code.');
    }
  };

  const loginPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email.trim(), password);
      go(returnTo);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center select-none">
          <Logo size={56} />
          <span className="mt-3 font-heading text-sm tracking-[0.34em] text-foreground">PASKEY</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-7 shadow-sm">
          {mode === 'email' && (
            <>
              <h1 className="text-center text-2xl font-semibold tracking-tight text-foreground">Welcome</h1>
              <p className="mt-1.5 text-center text-sm text-muted-foreground">Sign in or create your PasKey account.</p>

              <Button variant="outline" className="mt-7 w-full h-12 text-sm font-medium" onClick={handleGoogle}>
                <GoogleIcon className="mr-2.5 h-5 w-5" /> Continue with Google
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-[11px] uppercase tracking-widest">
                  <span className="bg-card px-3 text-muted-foreground">or</span>
                </div>
              </div>

              {error && <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

              <form onSubmit={continueEmail} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email" inputMode="email" autoComplete="email" autoFocus
                    placeholder="you@example.com" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 pl-10" required
                  />
                </div>
                <Button type="submit" className="h-12 w-full font-medium" disabled={loading}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Please wait…</>
                    : <>Continue <ChevronRight className="ml-1 h-4 w-4" /></>}
                </Button>
              </form>
            </>
          )}

          {mode === 'otp' && (
            <>
              <button type="button" onClick={() => { setMode('email'); setError(''); setOtp(''); }} className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </button>
              <h1 className="text-center text-2xl font-semibold tracking-tight text-foreground">Verify your email</h1>
              <p className="mt-1.5 text-center text-sm text-muted-foreground">
                Enter the verification code sent to<br /><span className="text-foreground">{email}</span>
              </p>

              {error && <div className="mt-5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

              <div className="mt-6 flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={setOtp} autoFocus autoComplete="one-time-code">
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button className="mt-6 h-12 w-full font-medium" onClick={verifyOtp} disabled={loading || otp.length < 6}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…</> : 'Verify'}
              </Button>

              <p className="mt-5 text-center text-sm text-muted-foreground">
                Didn't get it?{' '}
                <button type="button" onClick={resend} disabled={cooldown > 0} className="font-medium text-foreground hover:underline disabled:opacity-50">
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
              </p>
            </>
          )}

          {mode === 'password' && (
            <>
              <button type="button" onClick={() => { setMode('email'); setError(''); setPassword(''); }} className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </button>
              <h1 className="text-center text-2xl font-semibold tracking-tight text-foreground">Welcome back</h1>
              <p className="mt-1.5 text-center text-sm text-muted-foreground">
                Enter your password for<br /><span className="text-foreground">{email}</span>
              </p>

              {error && <div className="mt-5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

              <form onSubmit={loginPassword} className="mt-6 space-y-3">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password" autoComplete="current-password" autoFocus placeholder="Your password"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    className="h-12 pl-10" required
                  />
                </div>
                <Button type="submit" className="h-12 w-full font-medium" disabled={loading}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</> : 'Sign in'}
                </Button>
              </form>

              <p className="mt-5 text-center text-sm text-muted-foreground">
                Forgot your password?{' '}
                <Link to={`/forgot-password?email=${encodeURIComponent(email)}`} className="font-medium text-foreground hover:underline">Reset it</Link>
              </p>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground/80">
          PasKey identifies you with Google or email. Your <span className="text-foreground">Master Password</span> is separate and protects your encrypted vault.
        </p>
      </div>
    </div>
  );
}