import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/endpoints.js';
import { setUnauthorizedHandler, tokenStore } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  const logout = useCallback(() => { tokenStore.clear(); setUser(null); }, []);

  const refreshUser = useCallback(async () => {
    if (!tokenStore.get()) return null;
    try {
      const u = await authApi.me();
      setUser(u);
      return u;
    } catch {
      logout();
    }
  }, [logout]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokenStore.get()) return;
    authApi.me().then(setUser).catch(logout).finally(() => setLoading(false));
  }, [logout]);

  const startSession = useCallback(({ token, user: u }) => { tokenStore.set(token); setUser(u); }, []);

  const value = useMemo(() => ({
    user,
    loading,
    login: async (creds) => startSession(await authApi.login(creds)),
    signup: async (data) => startSession(await authApi.signup(data)),
    updateProfile: async (data) => setUser(await authApi.updateMe(data)),
    setUser,
    refreshUser,
    logout,
  }), [user, loading, logout, startSession, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
