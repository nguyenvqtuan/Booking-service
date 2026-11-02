import { z } from 'zod';
import { type AppointmentSource, AppointmentStatus } from './enums.js';

const isoInstant = z.iso.datetime({ offset: true });

export const appointmentCreateSchema = z.object({
  customerId: z.uuid(),
  staffId: z.uuid(),
  serviceId: z.uuid(),
  /** ISO 8601 instant with offset, e.g. "2026-11-02T08:00:00Z" (= 15:00 in Vietnam). */
  startAt: isoInstant,
  note: z
    .string()
    .trim()
    .max(1000)
    .transform((v) => v || null)
    .nullable()
    .optional(),
});
export type AppointmentCreate = z.input<typeof appointmentCreateSchema>;
export type AppointmentCreateParsed = z.output<typeof appointmentCreateSchema>;

/** Reschedule / reassign / edit; only allowed while the appointment is active. */
export const appointmentUpdateSchema = appointmentCreateSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
export type AppointmentUpdate = z.input<typeof appointmentUpdateSchema>;
export type AppointmentUpdateParsed = z.output<typeof appointmentUpdateSchema>;

export const appointmentListQuerySchema = z
  .object({ from: isoInstant, to: isoInstant, staffId: z.uuid().optional() })
  .refine((q) => q.from < q.to, { message: '`from` must be before `to`', path: ['to'] });
export type AppointmentListQuery = z.input<typeof appointmentListQuerySchema>;

/**
 * Status state machine. Terminal states: cancelled, completed, no_show.
 * no_show also increments the customer's counter and is handled by its own endpoint (BS-41).
 */
const TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  [AppointmentStatus.Booked]: [
    AppointmentStatus.Confirmed,
    AppointmentStatus.Cancelled,
    AppointmentStatus.Completed,
    AppointmentStatus.NoShow,
  ],
  [AppointmentStatus.Confirmed]: [
    AppointmentStatus.Cancelled,
    AppointmentStatus.Completed,
    AppointmentStatus.NoShow,
  ],
  [AppointmentStatus.Cancelled]: [],
  [AppointmentStatus.Completed]: [],
  [AppointmentStatus.NoShow]: [],
};

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isActiveStatus(status: AppointmentStatus): boolean {
  return status === AppointmentStatus.Booked || status === AppointmentStatus.Confirmed;
}

/** Transitions available through POST /appointments/:id/status. */
export const appointmentStatusSchema = z.object({
  status: z.enum([
    AppointmentStatus.Confirmed,
    AppointmentStatus.Cancelled,
    AppointmentStatus.Completed,
  ]),
});
export type AppointmentStatusChange = z.input<typeof appointmentStatusSchema>;

export interface AppointmentDto {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  staffId: string;
  staffName: string;
  serviceId: string;
  serviceName: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  note: string | null;
}
