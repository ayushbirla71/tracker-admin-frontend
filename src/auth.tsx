import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getToken, post, setToken } from './api';

interface AuthValue {
  loggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(() => getToken() != null);

  useEffect(() => {
    const onLogout = () => setLoggedIn(false);
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await post<{ token: string }>('/auth/login', { email, password });
    setToken(res.token);
    setLoggedIn(true);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setLoggedIn(false);
  }, []);

  return <AuthContext.Provider value={{ loggedIn, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
