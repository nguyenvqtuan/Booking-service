import type { ReminderMessage } from '../message-provider.js';

/** Defaults; the real text must match the carrier-approved template (SMS_TEMPLATE_*). */
export const DEFAULT_SMS_TEMPLATES: Record<ReminderMessage['locale'], string> = {
  vi: '{salon}: Nhac lich hen {service} luc {time} ngay {date}. Hen gap quy khach!',
  en: '{salon}: Reminder of your {service} appointment at {time} on {date}. See you soon!',
};

/** Removes Vietnamese diacritics so the SMS stays in the cheaper GSM-7 encoding. */
export function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

/** "2026-11-02" -> "02/11/2026" (vi) or "11/02/2026" (en). */
function displayDate(isoDate: string, locale: ReminderMessage['locale']): string {
  const [y, m, d] = isoDate.split('-');
  return locale === 'vi' ? `${d}/${m}/${y}` : `${m}/${d}/${y}`;
}

export function renderSms(template: string, message: ReminderMessage): string {
  const { params, locale } = message;
  const values: Record<string, string> = {
    salon: params.salonName,
    service: params.serviceName,
    name: params.customerName,
    time: params.time,
    date: displayDate(params.date, locale),
    link: params.actionUrl ?? '',
  };
  const text = template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
  return stripDiacritics(text);
}
