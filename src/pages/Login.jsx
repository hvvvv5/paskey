import React from 'react';
import AuthEntry from '@/components/paskey/AuthEntry';

// Unified auth entry: Continue with Google, or Continue with Email (OTP for
// new users, password for returning users). The PasKey Master Password is a
// separate credential handled after sign-in, in the vault onboarding.
export default function Login() {
  return <AuthEntry />;
}