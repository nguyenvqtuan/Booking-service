import { DateTime } from 'luxon';
import { WEEKDAYS, type Weekday } from './working-hours.js';

/**
 * Time rules (BS-24):
 * - Instants are stored and exchanged in UTC (timestamptz / ISO strings with offset).
 * - Wall-clock values ("2026-11-02", "15:00") are always interpreted in the salon's IANA
 *   timezone, never in the server's or browser's local zone.
 */

/** "YYYY-MM-DD" */
export type LocalDate = string;
/** "HH:mm" (24h) */
export type LocalTime = string;

function zoned(instant: Date, timeZone: string): DateTime {
  const dt = DateTime.fromJSDate(instant, { zone: timeZone });
  if (!dt.isValid) throw new Error(`Invalid timezone "${timeZone}"`);
  return dt;
}

/** Converts a salon wall-clock date + time to a UTC instant. */
export function localToUtc(date: LocalDate, time: LocalTime, timeZone: string): Date {
  const dt = DateTime.fromISO(`${date}T${time}`, { zone: timeZone });
  if (!dt.isValid) throw new Error(`Invalid local date/time "${date} ${time}" in ${timeZone}`);
  return dt.toJSDate();
}

/** Salon wall-clock representation of a UTC instant. */
export function utcToLocal(
  instant: Date,
  timeZone: string,
): { date: LocalDate; time: LocalTime; weekday: Weekday } {
  const dt = zoned(instant, timeZone);
  return {
    date: dt.toISODate()!,
    time: dt.toFormat('HH:mm'),
    weekday: WEEKDAYS[dt.weekday - 1],
  };
}

/** Weekday key (for working_hours) of a salon-local date. */
export function weekdayOf(date: LocalDate, timeZone: string): Weekday {
  const dt = DateTime.fromISO(date, { zone: timeZone });
  if (!dt.isValid) throw new Error(`Invalid date "${date}"`);
  return WEEKDAYS[dt.weekday - 1];
}

/** UTC instants bounding a salon-local calendar day: [start, end). */
export function localDayRangeUtc(date: LocalDate, timeZone: string): { from: Date; to: Date } {
  const start = DateTime.fromISO(date, { zone: timeZone }).startOf('day');
  if (!start.isValid) throw new Error(`Invalid date "${date}"`);
  return { from: start.toJSDate(), to: start.plus({ days: 1 }).toJSDate() };
}

/** When a reminder must be sent: `offsetMinutes` before the appointment start (absolute time). */
export function reminderSendAt(startAt: Date, offsetMinutes: number): Date {
  return new Date(startAt.getTime() - offsetMinutes * 60_000);
}

/** Appointment end: start + duration (absolute time). */
export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * 60_000);
}

/** True when `timeZone` is a valid IANA zone name (e.g. "Asia/Ho_Chi_Minh"). */
export function isValidTimeZone(timeZone: string): boolean {
  return DateTime.local().setZone(timeZone).isValid;
}
