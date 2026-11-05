import { z } from 'zod';
import { addMinutes, type LocalDate, localToUtc, utcToLocal, weekdayOf } from './time.js';
import type { WorkingHours } from './working-hours.js';

export const DEFAULT_SLOT_STEP_MIN = 15;

export const localDateSchema = z.iso.date();

export const slotQuerySchema = z.object({
  staffId: z.uuid(),
  serviceId: z.uuid(),
  date: localDateSchema,
});
export type SlotQuery = z.input<typeof slotQuerySchema>;

export interface TimeInterval {
  start: Date;
  end: Date;
}

export interface SlotDto {
  /** ISO instant to send back as `startAt` when booking. */
  startAt: string;
  /** Salon-local "HH:mm" for display. */
  time: string;
}

export interface ComputeSlotsInput {
  workingHours: WorkingHours;
  /** Active appointments of the staff member. */
  busy: TimeInterval[];
  durationMin: number;
  date: LocalDate;
  timeZone: string;
  now: Date;
  stepMin?: number;
}

/**
 * Free start times of one salon-local day (BS-36, BS-67): inside a shift, finishing before the
 * shift ends, not overlapping a booked interval and not in the past. Back-to-back is allowed.
 * Slots are aligned to the start of each shift.
 */
export function computeSlots(input: ComputeSlotsInput): SlotDto[] {
  const { workingHours, busy, durationMin, date, timeZone, now } = input;
  const stepMin = input.stepMin ?? DEFAULT_SLOT_STEP_MIN;
  const shifts = workingHours[weekdayOf(date, timeZone)] ?? [];
  const slots: SlotDto[] = [];

  for (const shift of shifts) {
    const shiftEnd = localToUtc(date, shift.end, timeZone);
    for (
      let start = localToUtc(date, shift.start, timeZone);
      addMinutes(start, durationMin) <= shiftEnd;
      start = addMinutes(start, stepMin)
    ) {
      const end = addMinutes(start, durationMin);
      if (start <= now) continue;
      if (busy.some((b) => b.start < end && b.end > start)) continue;
      slots.push({ startAt: start.toISOString(), time: utcToLocal(start, timeZone).time });
    }
  }
  return slots;
}
