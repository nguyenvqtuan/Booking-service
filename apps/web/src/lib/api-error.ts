import { isAxiosError } from 'axios';
import { type ApiErrorBody, ErrorCode } from '@booking/shared';

// TODO(BS-69): move these messages into the i18n resource files.
const MESSAGES: Partial<Record<ErrorCode, string>> = {
  [ErrorCode.AuthInvalidCredentials]: 'Email hoặc mật khẩu không đúng.',
  [ErrorCode.AuthEmailTaken]: 'Email này đã được đăng ký.',
  [ErrorCode.AuthInvalidResetToken]: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
  [ErrorCode.ValidationFailed]: 'Dữ liệu chưa hợp lệ, vui lòng kiểm tra lại.',
  [ErrorCode.RateLimited]: 'Bạn thao tác quá nhanh, vui lòng thử lại sau.',
};
const FALLBACK_MESSAGE = 'Có lỗi xảy ra, vui lòng thử lại.';

export function getApiErrorCode(error: unknown): ErrorCode | undefined {
  return isAxiosError<ApiErrorBody>(error) ? error.response?.data?.code : undefined;
}

export function getApiErrorMessage(error: unknown): string {
  const code = getApiErrorCode(error);
  return (code && MESSAGES[code]) || FALLBACK_MESSAGE;
}
