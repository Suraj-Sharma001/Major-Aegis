import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi, tokenStore } from '../services/api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(!!tokenStore.get());

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setOrganization(null);
    setTeams([]);
  }, []);

  const loadProfile = useCallback(async () => {
    const data = await authApi.me();
    setUser(data.user);
    setOrganization(data.organization);
    setTeams(data.teams);
  }, []);

  // Restore the session on first load.
  useEffect(() => {
    if (!tokenStore.get()) return;
    loadProfile().catch(() => logout()).finally(() => setLoading(false));
  }, [loadProfile, logout]);

  // Any 401 from the API means the session expired.
  useEffect(() => {
    const onUnauthorized = () => logout();
    window.addEventListener('aegis:unauthorized', onUnauthorized);
    return () => window.removeEventListener('aegis:unauthorized', onUnauthorized);
  }, [logout]);

  const login = async (email, password) => {
    const data = await authApi.login({ email, password });
    tokenStore.set(data.token);
    await loadProfile();
  };

  const register = async (form) => {
    const data = await authApi.register(form);
    tokenStore.set(data.token);
    await loadProfile();
  };

  const value = {
    user, organization, teams, loading,
    isAdmin: user?.role === 'ADMIN',
    canBuild: user?.role === 'ADMIN' || user?.role === 'DEVELOPER',
    login, register, logout, refreshProfile: loadProfile,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
