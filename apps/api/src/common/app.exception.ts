import { HttpException, type HttpStatus } from '@nestjs/common';
import type { ApiErrorBody, ErrorCode } from '@booking/shared';

/** HttpException carrying a stable error code (see ErrorCode in @booking/shared). */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ErrorCode,
    message: string,
    readonly fields?: ApiErrorBody['fields'],
  ) {
    super({ statusCode: status, code, message, fields } satisfies ApiErrorBody, status);
  }
}
