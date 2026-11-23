import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import Register from './pages/Register';
import Overview from './pages/Overview';
import Applications from './pages/Applications';
import ApplicationDetail from './pages/ApplicationDetail';
import Playground from './pages/Playground';
import Teams from './pages/Teams';
import ProviderKeys from './pages/ProviderKeys';
import SettingsPage from './pages/Settings';
import NotFound from './pages/NotFound';

function Protected({ children, adminOnly }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) {
    return <div className="h-full grid place-items-center"><Spinner className="h-6 w-6 text-muted" /></div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/" element={<Overview />} />
        <Route path="/applications" element={<Applications />} />
        <Route path="/applications/:id" element={<ApplicationDetail />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/teams" element={<Teams />} />
        <Route path="/provider-keys" element={<Protected adminOnly><ProviderKeys /></Protected>} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
