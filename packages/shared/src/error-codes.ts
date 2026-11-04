/**
 * Stable machine-readable error codes returned by the API as `{ code, message }`.
 * The web app translates them (BS-69); never rely on `message` for logic.
 */
export const ErrorCode = {
  ValidationFailed: 'VALIDATION_FAILED',
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  NotFound: 'NOT_FOUND',
  Conflict: 'CONFLICT',
  RateLimited: 'RATE_LIMITED',
  ServiceUnavailable: 'SERVICE_UNAVAILABLE',
  InternalError: 'INTERNAL_ERROR',
  AuthInvalidCredentials: 'AUTH_INVALID_CREDENTIALS',
  AuthEmailTaken: 'AUTH_EMAIL_TAKEN',
  AuthInvalidRefreshToken: 'AUTH_INVALID_REFRESH_TOKEN',
  AuthInvalidResetToken: 'AUTH_INVALID_RESET_TOKEN',
  ServiceInUse: 'SERVICE_IN_USE',
  StaffInUse: 'STAFF_IN_USE',
  CustomerInUse: 'CUSTOMER_IN_USE',
  CustomerPhoneTaken: 'CUSTOMER_PHONE_TAKEN',
  AppointmentOverlap: 'APPOINTMENT_OVERLAP',
  AppointmentInvalidTransition: 'APPOINTMENT_INVALID_TRANSITION',
  AppointmentNotEditable: 'APPOINTMENT_NOT_EDITABLE',
  StaffCannotPerformService: 'STAFF_CANNOT_PERFORM_SERVICE',
  ReferenceInactive: 'REFERENCE_INACTIVE',
  SlotUnavailable: 'SLOT_UNAVAILABLE',
  ActionTokenInvalid: 'ACTION_TOKEN_INVALID',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiErrorBody {
  statusCode: number;
  code: ErrorCode;
  message: string;
  /** Field-level validation issues, keyed by dotted path. */
  fields?: Record<string, string[]>;
}
