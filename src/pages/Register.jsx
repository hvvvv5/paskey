import React from 'react';
import AuthEntry from '@/components/paskey/AuthEntry';

// Same unified entry as Login — there is no separate registration form. New
// email users are detected automatically and verified via OTP.
export default function Register() {
  return <AuthEntry />;
}