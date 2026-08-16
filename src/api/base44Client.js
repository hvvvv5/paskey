// PasKey is local-first: it does NOT call Base44 at runtime (no auth, no
// entities, no backend functions). This module exports an inert `base44` stub
// only because the platform-managed AuthContext.jsx is required to import it.
// No `@base44/sdk` is imported here, so the SDK is NOT pulled into the
// production bundle. The Android (Capacitor) build removes this file and
// AuthContext entirely, finishing the break from Base44.
export const base44 = {
  auth: {
    me: async () => null,
    logout: () => {},
    redirectToLogin: () => {},
    setToken: () => {},
    loginWithProvider: () => {},
    loginViaEmailPassword: async () => {},
    register: async () => {},
    verifyOtp: async () => ({}),
    resendOtp: async () => {},
    isAuthenticated: async () => true,
  },
  entities: {},
  functions: { invoke: async () => null },
  users: { inviteUser: async () => {} },
  analytics: { track: () => {} },
};