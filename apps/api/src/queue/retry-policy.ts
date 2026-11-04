import type { ConfigService } from '@nestjs/config';

/** Reminder retry policy (BS-32): only transient failures are retried, with growing delays. */
export interface RetryPolicy {
  /** Delay before retry n (1-based), e.g. [60000, 300000, 900000]. */
  delaysMs: number[];
  /** First attempt + one per delay. */
  attempts: number;
}

export function retryPolicyFrom(config: ConfigService): RetryPolicy {
  const delaysMs = (config.get<string>('REMINDER_RETRY_DELAYS_MS') ?? '60000,300000,900000')
    .split(',')
    .map(Number);
  return { delaysMs, attempts: delaysMs.length + 1 };
}

/** BullMQ backoff strategy: attemptsMade = number of attempts already made (1 after the first). */
export function backoffDelay(policy: RetryPolicy, attemptsMade: number): number {
  return policy.delaysMs[Math.min(attemptsMade, policy.delaysMs.length) - 1] ?? 0;
}

export const REMINDER_BACKOFF_TYPE = 'reminder';
