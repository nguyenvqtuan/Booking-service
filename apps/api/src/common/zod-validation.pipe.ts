import { HttpStatus, type PipeTransform } from '@nestjs/common';
import { ErrorCode } from '@booking/shared';
import type { z } from 'zod';
import { AppException } from './app.exception.js';

/** Validates and parses a request part with a Zod schema shared with the web app. */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    const fields: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      (fields[key] ??= []).push(issue.message);
    }
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.ValidationFailed,
      'Validation failed',
      fields,
    );
  }
}
