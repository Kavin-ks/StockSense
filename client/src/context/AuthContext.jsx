import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/endpoints.js';
import { setUnauthorizedHandler, tokenStore } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  const logout = useCallback(() => { tokenStore.clear(); setUser(null); }, []);

  const resolveUserWithAvatar = useCallback((u) => {
    if (!u) return null;
    let localAvatar = null;
    try {
      localAvatar = localStorage.getItem('stocksense_avatar_' + (u.id || 'default'));
    } catch {}
    const validAvatar = (localAvatar && localAvatar.startsWith('data:image/'))
      ? localAvatar
      : (u.avatarUrl && u.avatarUrl.startsWith('data:image/'))
        ? u.avatarUrl
        : null;
    return { ...u, avatarUrl: validAvatar };
  }, []);

  const refreshUser = useCallback(async () => {
    if (!tokenStore.get()) return null;
    try {
      const u = await authApi.me();
      const resolved = resolveUserWithAvatar(u);
      setUser(resolved);
      return resolved;
    } catch {
      logout();
    }
  }, [logout, resolveUserWithAvatar]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokenStore.get()) return;
    authApi.me().then((u) => setUser(resolveUserWithAvatar(u))).catch(logout).finally(() => setLoading(false));
  }, [logout, resolveUserWithAvatar]);

  const startSession = useCallback(({ token, user: u }) => {
    tokenStore.set(token);
    setUser(resolveUserWithAvatar(u));
  }, [resolveUserWithAvatar]);

  const value = useMemo(() => ({
    user,
    loading,
    login: async (creds) => startSession(await authApi.login(creds)),
    signup: async (data) => startSession(await authApi.signup(data)),
    updateProfile: async (data) => {
      const updated = await authApi.updateMe(data);
      const resolved = resolveUserWithAvatar(updated);
      setUser(resolved);
      return resolved;
    },
    setUser,
    refreshUser,
    logout,
  }), [user, loading, logout, startSession, refreshUser, resolveUserWithAvatar]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
