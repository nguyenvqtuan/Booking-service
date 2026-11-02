import { DEFAULT_TIMEZONE, localDayRangeUtc, localToUtc, utcToLocal } from '@booking/shared';

/** Today's date in the salon timezone ("YYYY-MM-DD"). */
export const salonToday = (timeZone = DEFAULT_TIMEZONE) => utcToLocal(new Date(), timeZone).date;

/** ISO range [from, to) covering one salon-local day. */
export function salonDayRange(date: string, timeZone = DEFAULT_TIMEZONE) {
  const { from, to } = localDayRangeUtc(date, timeZone);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** "HH:mm" of an instant in the salon timezone. */
export const salonTime = (iso: string, timeZone = DEFAULT_TIMEZONE) =>
  utcToLocal(new Date(iso), timeZone).time;

/** Salon-local date + time to an ISO instant. */
export const salonInstant = (date: string, time: string, timeZone = DEFAULT_TIMEZONE) =>
  localToUtc(date, time, timeZone).toISOString();
