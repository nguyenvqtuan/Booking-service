export const REMINDER_QUEUE_NAME = 'reminders';
/** Injection token of the BullMQ Queue for reminders. */
export const REMINDER_QUEUE = Symbol('REMINDER_QUEUE');

/** Injection token of a general-purpose Redis client (e.g. OTP codes). */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/** Payload of a reminder queue job; the BullMQ job id is the reminder_jobs.id too (BS-33). */
export interface ReminderQueuePayload {
  reminderJobId: string;
}
