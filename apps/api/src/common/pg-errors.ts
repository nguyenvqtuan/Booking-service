import { QueryFailedError } from 'typeorm';

/** Postgres SQLSTATE codes used by the app. */
export const PgErrorCode = {
  UniqueViolation: '23505',
  ForeignKeyViolation: '23503',
  ExclusionViolation: '23P01',
} as const;

/** True when `error` is a Postgres error with the given code (and constraint, if provided). */
export function isPgError(error: unknown, code: string, constraint?: string): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError = error.driverError as { code?: string; constraint?: string };
  return driverError.code === code && (!constraint || driverError.constraint === constraint);
}
