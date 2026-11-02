import type { FieldError } from 'react-hook-form';
import { PASSWORD_MIN_LENGTH } from '@booking/shared';
import i18n from '../i18n';

/** Maps Zod issue codes (exposed by zodResolver as `error.type`) to translated messages. */
export function fieldErrorMessage(
  error: FieldError | undefined,
  field?: string,
): string | undefined {
  if (!error) return undefined;
  switch (error.type) {
    case 'too_small':
      return field === 'password'
        ? i18n.t('validation:password_too_small', { min: PASSWORD_MIN_LENGTH })
        : i18n.t('validation:too_small');
    case 'too_big':
      return i18n.t('validation:too_big');
    case 'invalid_format':
      return i18n.t('validation:invalid_email');
    case 'passwords_mismatch':
      return i18n.t('validation:passwords_mismatch');
    default:
      return i18n.t('validation:invalid');
  }
}
