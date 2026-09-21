import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { queryClientInstance } from '@/lib/query-client';
import PageNotFound from './lib/PageNotFound';
import ScrollToTop from './components/ScrollToTop';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppShell from '@/components/paskey/AppShell';
import Vault from '@/pages/Vault';
import Autofill from '@/pages/Autofill';
import Category from '@/pages/Category';
import ItemDetail from '@/pages/ItemDetail';
import ItemForm from '@/pages/ItemForm';
import Generator from '@/pages/Generator';
import Security from '@/pages/Security';
import Settings from '@/pages/Settings';
import Privacy from '@/pages/Privacy';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return <div className="fixed inset-0 flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" /></div>;
  }
  if (authError?.type === 'user_not_registered') return <UserNotRegisteredError />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Vault />} />
        <Route path="/autofill" element={<Autofill />} />
        <Route path="/login-vault" element={<Navigate to="/autofill" replace />} />
        <Route path="/c/:key" element={<Category />} />
        <Route path="/item/:cat/:id" element={<ItemDetail />} />
        <Route path="/new/:cat" element={<ItemForm />} />
        <Route path="/edit/:cat/:id" element={<ItemForm />} />
        <Route path="/generator" element={<Generator />} />
        <Route path="/security" element={<Security />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/privacy" element={<Privacy />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

export default function App() {
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
  );
}
