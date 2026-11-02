import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthResponse, AuthUser, Locale, LoginInput, RegisterInput } from '@booking/shared';
import i18n, { currentLocale } from '../i18n';
import { api } from '../lib/api';
import { onSessionChange, refreshSession, setSession } from '../lib/session';
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const userRef = useRef<AuthUser | null>(null);

  useEffect(() => {
    const unsubscribe = onSessionChange((session) => {
      userRef.current = session?.user ?? null;
      setUser(userRef.current);
      setStatus(session ? 'authenticated' : 'anonymous');
      // The language saved in the profile follows the user across devices.
      if (session && session.user.locale !== currentLocale()) {
        void i18n.changeLanguage(session.user.locale);
      }
    });
    // Restore the session from the refresh cookie on page load.
    refreshSession().catch(() => setStatus('anonymous'));
    return unsubscribe;
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const { data } = await api.post<AuthResponse>('/auth/login', input);
    setSession(data);
  }, []);

  const register = useCallback(async (input: Omit<RegisterInput, 'locale'>) => {
    const { data } = await api.post<AuthResponse>('/auth/register', {
      ...input,
      locale: currentLocale(),
    });
    setSession(data);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setSession(null);
    }
  }, []);

  const setLocale = useCallback(async (locale: Locale) => {
    await i18n.changeLanguage(locale);
    if (userRef.current && userRef.current.locale !== locale) {
      const { data } = await api.patch<AuthUser>('/auth/me', { locale });
      userRef.current = data;
      setUser(data);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, register, logout, setLocale }),
    [status, user, login, register, logout, setLocale],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
