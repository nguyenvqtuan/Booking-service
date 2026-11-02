import {
  Appointment,
  Customer,
  MessageLog,
  PasswordResetToken,
  RefreshToken,
  ReminderJob,
  ReminderSetting,
  Salon,
  Service,
  Staff,
  StaffService,
  User,
} from './entities/index.js';

/**
 * Entities are registered explicitly (no globs) so the app, the CLI and tests
 * share a single source of truth.
 */
export const ENTITIES = [
  Salon,
  User,
  Staff,
  Service,
  StaffService,
  Customer,
  Appointment,
  ReminderJob,
  MessageLog,
  ReminderSetting,
  RefreshToken,
  PasswordResetToken,
];
