import { base44 } from '@/api/base44Client';

// Thin wrapper around the recoveryService backend function.
// Always resolves to a plain object ({ ok, ... } or { error }), never throws,
// so UI code can treat both network errors and business errors uniformly.
export async function callRecovery(payload) {
  try {
    const r = await base44.functions.invoke('recoveryService', payload);
    return r?.data ?? r ?? { ok: false, error: 'No response from recovery service.' };
  } catch (e) {
    return e?.response?.data ?? { ok: false, error: 'Network error. Please try again.' };
  }
}