import axios from 'axios';
import type { AuthResponse } from '@booking/shared';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/**
 * The access token lives only in memory; the refresh token is an httpOnly cookie
 * the browser sends to /auth/* automatically.
 */
let accessToken: string | null = null;
let refreshInFlight: Promise<AuthResponse> | null = null;
const listeners = new Set<(session: AuthResponse | null) => void>();

export const getAccessToken = () => accessToken;

export function setSession(session: AuthResponse | null): void {
  accessToken = session?.accessToken ?? null;
  listeners.forEach((listener) => listener(session));
}

/** Subscribes to session changes (login, refresh, expiry). Returns an unsubscribe function. */
export function onSessionChange(listener: (session: AuthResponse | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Exchanges the refresh cookie for a new access token. Concurrent callers share one request:
 * refresh tokens rotate, so a second parallel refresh would look like token reuse and
 * revoke the whole session.
 */
export function refreshSession(): Promise<AuthResponse> {
  refreshInFlight ??= axios
    .post<AuthResponse>(`${API_URL}/auth/refresh`, null, { withCredentials: true })
    .then((res) => {
      setSession(res.data);
      return res.data;
    })
    .catch((err: unknown) => {
      setSession(null);
      throw err;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}
