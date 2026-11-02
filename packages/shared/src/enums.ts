export enum AppointmentStatus {
  Booked = 'booked',
  Confirmed = 'confirmed',
  Cancelled = 'cancelled',
  Completed = 'completed',
  NoShow = 'no_show',
}

/** Trạng thái chiếm slot của nhân viên (dùng cho exclusion constraint và tính slot). */
export const ACTIVE_APPOINTMENT_STATUSES = [
  AppointmentStatus.Booked,
  AppointmentStatus.Confirmed,
] as const;

export enum AppointmentSource {
  Admin = 'admin',
  Online = 'online',
}

export enum ReminderJobStatus {
  Pending = 'pending',
  Queued = 'queued',
  Sending = 'sending',
  Retrying = 'retrying',
  Sent = 'sent',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export enum MessageChannel {
  Zns = 'zns',
  Sms = 'sms',
}

export enum MessageLogStatus {
  Success = 'success',
  RecipientUnreachable = 'recipient_unreachable',
  Transient = 'transient',
  Permanent = 'permanent',
}
