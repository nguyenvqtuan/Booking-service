import { z } from 'zod';
import type { MessageChannel, ReminderJobStatus } from './enums.js';

export const REMINDER_MIN_OFFSET_MIN = 5;
export const REMINDER_MAX_OFFSET_MIN = 7 * 24 * 60;
export const REMINDER_MAX_OFFSETS = 5;

export const reminderSettingsSchema = z.object({
  /** Minutes before the appointment; stored unique and sorted descending (e.g. [1440, 120]). */
  offsets: z
    .array(z.number().int().min(REMINDER_MIN_OFFSET_MIN).max(REMINDER_MAX_OFFSET_MIN))
    .max(REMINDER_MAX_OFFSETS)
    .transform((list) => [...new Set(list)].sort((a, b) => b - a)),
  fallbackEnabled: z.boolean(),
});
export type ReminderSettingsInput = z.input<typeof reminderSettingsSchema>;
export type ReminderSettingsDto = z.output<typeof reminderSettingsSchema>;

export interface ReminderJobDto {
  id: string;
  offsetMinutes: number;
  sendAt: string;
  channel: MessageChannel;
  status: ReminderJobStatus;
  attemptCount: number;
}
