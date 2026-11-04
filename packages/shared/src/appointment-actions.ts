import { z } from 'zod';
import type { AppointmentStatus } from './enums.js';

export const rescheduleByLinkSchema = z.object({ startAt: z.iso.datetime({ offset: true }) });
export type RescheduleByLink = z.input<typeof rescheduleByLinkSchema>;

export const actionSlotsQuerySchema = z.object({ date: z.iso.date() });

/** What a customer sees on the page opened from a reminder link (BS-37). */
export interface AppointmentActionView {
  salonName: string;
  timezone: string;
  serviceName: string;
  staffName: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
}
