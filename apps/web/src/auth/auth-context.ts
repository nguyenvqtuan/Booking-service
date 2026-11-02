import { createContext, useContext } from 'react';
import type { AuthUser, Locale, LoginInput, RegisterInput } from '@booking/shared';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  login(input: LoginInput): Promise<void>;
  register(input: Omit<RegisterInput, 'locale'>): Promise<void>;
  logout(): Promise<void>;
  /** Switches the UI language and saves it to the profile when signed in. */
  setLocale(locale: Locale): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
