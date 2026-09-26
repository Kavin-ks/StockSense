import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/endpoints.js';
import { setUnauthorizedHandler, tokenStore } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  const logout = useCallback(() => { tokenStore.clear(); setUser(null); }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokenStore.get()) return;
    authApi.me().then(setUser).catch(logout).finally(() => setLoading(false));
  }, [logout]);

  const startSession = useCallback(({ token, user: u }) => { tokenStore.set(token); setUser(u); }, []);
  // Re-read the profile (role + permissions) after a manager changes it.
  const refresh = useCallback(() => authApi.me().then(setUser).catch(() => {}), []);

  const value = useMemo(() => {
    const permissions = new Set(user?.permissions ?? []);
    return {
      user,
      loading,
      isManager: user?.role === 'manager',
      /** Same permission names the API enforces (server/src/config/permissions.js). */
      can: (permission) => permissions.has(permission),
      login: async (creds) => startSession(await authApi.login(creds)),
      // Sign-up does not start a session: the account waits for a manager's approval.
      signup: (data) => authApi.signup(data),
      updateProfile: async (data) => setUser(await authApi.updateMe(data)),
      refresh,
      logout,
    };
  }, [user, loading, logout, startSession, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
