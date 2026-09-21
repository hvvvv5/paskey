import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import ScrollToTop from './components/ScrollToTop';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppShell from '@/components/paskey/AppShell';
import Vault from '@/pages/Vault';
import Category from '@/pages/Category';
import ItemDetail from '@/pages/ItemDetail';
import ItemForm from '@/pages/ItemForm';
import Generator from '@/pages/Generator';
import Security from '@/pages/Security';
import Settings from '@/pages/Settings';
import Privacy from '@/pages/Privacy';
import NativeLayer from '@/pages/NativeLayer';

// The AuthProvider wrapper is retained per platform requirement, but the auth
// context is a Base44-free local stub (see AuthContext.jsx): it reports the
// user as authenticated immediately and makes no network calls. Access to the
// vault is gated entirely by the local Master Password (VaultContext), so the
// app opens directly into the vault setup / unlock flow — no online account.
const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Vault />} />
        <Route path="/c/:key" element={<Category />} />
        <Route path="/item/:cat/:id" element={<ItemDetail />} />
        <Route path="/new/:cat" element={<ItemForm />} />
        <Route path="/edit/:cat/:id" element={<ItemForm />} />
        <Route path="/generator" element={<Generator />} />
        <Route path="/security" element={<Security />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/native" element={<NativeLayer />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App