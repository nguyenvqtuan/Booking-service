import { DEFAULT_TIMEZONE, type Locale } from '@booking/shared';

const INTL_LOCALE: Record<Locale, string> = { vi: 'vi-VN', en: 'en-US' };

/** Formats an instant in the salon's timezone, e.g. "15:00 02/11/2026" (vi) or "11/02/2026, 3:00 PM" (en). */
export function formatDateTime(
  value: Date | string,
  locale: Locale,
  timeZone = DEFAULT_TIMEZONE,
): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(value));
}

/** Formats a VND amount, e.g. "100.000 ₫" (vi) or "₫100,000" (en). */
export function formatCurrency(amountVnd: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amountVnd);
}
