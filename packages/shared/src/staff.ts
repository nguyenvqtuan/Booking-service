import { z } from 'zod';
import { normalizePhone } from './phone.js';
import { type Shift, WEEKDAYS, type WorkingHours } from './working-hours.js';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const shiftSchema = z
  .object({ start: z.string().regex(HHMM), end: z.string().regex(HHMM) })
  .refine((s) => s.start < s.end, { message: 'Shift must end after it starts', path: ['end'] });

/** Shifts of one day: sorted on output, rejected when they overlap. */
const dayShiftsSchema = z
  .array(shiftSchema)
  .max(6)
  .transform((shifts) => [...shifts].sort((a, b) => a.start.localeCompare(b.start)))
  .refine((shifts) => shifts.every((s, i) => i === 0 || shifts[i - 1].end <= s.start), {
    message: 'Shifts must not overlap',
  });

/** Normalizes to all 7 weekdays (a day off is []), shifts sorted by start time. */
export const workingHoursSchema = z
  .object(
    Object.fromEntries(WEEKDAYS.map((d) => [d, dayShiftsSchema.optional()])) as Record<
      (typeof WEEKDAYS)[number],
      z.ZodOptional<typeof dayShiftsSchema>
    >,
  )
  .strict()
  .transform(
    (wh) => Object.fromEntries(WEEKDAYS.map((d) => [d, wh[d] ?? []])) as Required<WorkingHours>,
  );

export const staffInputSchema = z.object({
  name: z.string().trim().min(1).max(150),
  /** Optional; normalized to E.164 when given. */
  phone: z
    .string()
    .trim()
    .max(30)
    .transform((value, ctx) => {
      if (!value) return null;
      const e164 = normalizePhone(value);
      if (!e164) {
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid phone number',
          params: { reason: 'phone' },
        });
        return z.NEVER;
      }
      return e164;
    })
    .nullable()
    .optional(),
  workingHours: workingHoursSchema,
  serviceIds: z.array(z.uuid()).max(100).default([]),
});
export type StaffInput = z.input<typeof staffInputSchema>;
export type StaffInputParsed = z.output<typeof staffInputSchema>;

export const staffUpdateSchema = staffInputSchema
  // No default here: omitting serviceIds in a PATCH must keep the current services.
  .extend({ isActive: z.boolean(), serviceIds: z.array(z.uuid()).max(100) })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
export type StaffUpdate = z.input<typeof staffUpdateSchema>;
export type StaffUpdateParsed = z.output<typeof staffUpdateSchema>;

export interface StaffDto {
  id: string;
  name: string;
  phone: string | null;
  workingHours: Required<WorkingHours>;
  isActive: boolean;
  serviceIds: string[];
}

/** Shifts a staff member works on a given weekday (empty when off). */
export function shiftsOn(workingHours: WorkingHours, weekday: (typeof WEEKDAYS)[number]): Shift[] {
  return workingHours[weekday] ?? [];
}
