import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/endpoints.js';
import { setUnauthorizedHandler, tokenStore } from '../api/client.js';
import { setFormatPreferences } from '../utils.js';

const AuthContext = createContext(null);

const DEFAULT_PREFS = {
  defaultWarehouseId: null,
  landingPage: '/',
  dateFormat: 'DD/MM/YYYY',
  numberFormat: 'standard',
  notifications: { lowStock: true, receipts: true, deliveries: true, adjustments: true, dailyDigest: false },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  const applyPrefs = useCallback((p) => {
    setFormatPreferences(p);
    setPrefs(p);
    return p;
  }, []);

  /** Forget the session locally (used when the server already rejected the token). */
  const endSession = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    applyPrefs(DEFAULT_PREFS);
  }, [applyPrefs]);

  /** Sign out: end the session on the server too, so the token cannot be reused. */
  const logout = useCallback(() => {
    if (tokenStore.get()) authApi.logout().catch(() => {});
    endSession();
  }, [endSession]);

  const loadSession = useCallback(async () => {
    const [u, p] = await Promise.all([authApi.me(), authApi.preferences().catch(() => DEFAULT_PREFS)]);
    setUser(u);
    applyPrefs(p);
    return { user: u, prefs: p };
  }, [applyPrefs]);

  const refreshUser = useCallback(async () => {
    if (!tokenStore.get()) return null;
    try {
      const u = await authApi.me();
      setUser(u);
      return u;
    } catch {
      endSession();
      return null;
    }
  }, [endSession]);

  useEffect(() => {
    setUnauthorizedHandler(endSession);
    if (!tokenStore.get()) return;
    loadSession().catch(endSession).finally(() => setLoading(false));
  }, [endSession, loadSession]);

  // Re-read the profile (role + permissions) after a manager changes it.
  const refresh = useCallback(() => authApi.me().then(setUser).catch(() => {}), []);

  const value = useMemo(() => {
    const permissions = new Set(user?.permissions ?? []);
    return {
      user,
      prefs,
      loading,
      isManager: user?.role === 'manager',
      /** Same permission names the API enforces (server/src/config/permissions.js). */
      can: (permission) => permissions.has(permission),
      /** Signs in and returns the user's preferred landing page. */
      login: async (creds) => {
        const { token } = await authApi.login(creds);
        tokenStore.set(token);
        const { prefs: p } = await loadSession();
        return p.landingPage || '/';
      },
      // Sign-up does not start a session: the account waits for a manager's approval.
      signup: (data) => authApi.signup(data),
      updateProfile: async (data) => setUser(await authApi.updateMe(data)),
      updatePreferences: async (patch) => applyPrefs(await authApi.updatePreferences(patch)),
      setUser,
      refresh,
      refreshUser,
      logout,
      endSession,
    };
  }, [user, prefs, loading, logout, endSession, loadSession, refresh, refreshUser, applyPrefs]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
