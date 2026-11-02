import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_URL, getAccessToken, refreshSession } from './session';

/** Shared API client: attaches the access token and transparently refreshes it on 401. */
export const api = axios.create({ baseURL: API_URL, withCredentials: true });

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

/** Auth endpoints never trigger a refresh (a 401 there is a real answer). */
const isAuthEndpoint = (url = '') => /\/auth\/(login|register|refresh|logout)/.test(url);

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as RetriableConfig | undefined;
  if (error.response?.status !== 401 || !config || config._retried || isAuthEndpoint(config.url)) {
    throw error;
  }
  config._retried = true;
  await refreshSession(); // throws (and clears the session) when the refresh token is invalid
  return api(config);
});
