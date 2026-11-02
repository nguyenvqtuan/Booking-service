import { isAxiosError } from 'axios';
import type { ApiErrorBody, ErrorCode } from '@booking/shared';
import i18n from '../i18n';

export function getApiErrorCode(error: unknown): ErrorCode | undefined {
  return isAxiosError<ApiErrorBody>(error) ? error.response?.data?.code : undefined;
}

/** Translated message for an API error, based on its stable `code`. */
export function getApiErrorMessage(error: unknown): string {
  const code = getApiErrorCode(error);
  const key = code && i18n.exists(`errors:${code}`) ? code : 'fallback';
  return i18n.t(`errors:${key}` as 'errors:fallback');
}
