import type { FieldError } from 'react-hook-form';
import { PASSWORD_MIN_LENGTH } from '@booking/shared';

// TODO(BS-69): move these messages into the i18n resource files.
/** Maps Zod issue codes (exposed by zodResolver as `error.type`) to Vietnamese messages. */
export function fieldErrorMessage(
  error: FieldError | undefined,
  field?: string,
): string | undefined {
  if (!error) return undefined;
  switch (error.type) {
    case 'too_small':
      return field === 'password'
        ? `Mật khẩu tối thiểu ${PASSWORD_MIN_LENGTH} ký tự.`
        : 'Giá trị quá ngắn.';
    case 'too_big':
      return 'Giá trị quá dài.';
    case 'invalid_format':
      return 'Email không hợp lệ.';
    case 'passwords_mismatch':
      return 'Mật khẩu nhập lại không khớp.';
    default:
      return 'Giá trị không hợp lệ.';
  }
}
