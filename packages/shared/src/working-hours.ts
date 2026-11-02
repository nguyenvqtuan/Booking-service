/** Weekday keys used by working_hours (salon local time). */
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** A single shift as "HH:mm" in salon local time. */
export interface Shift {
  start: string;
  end: string;
}

/**
 * Working hours per weekday. A day off is an empty array (or a missing key).
 * Example: { mon: [{ start: '09:00', end: '12:00' }, { start: '13:30', end: '20:00' }], sun: [] }
 */
export type WorkingHours = Partial<Record<Weekday, Shift[]>>;
