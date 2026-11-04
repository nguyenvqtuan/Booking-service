import type { ConfigService } from '@nestjs/config';
import { backoffDelay, retryPolicyFrom } from './retry-policy.js';

const config = (value?: string) => ({ get: () => value }) as unknown as ConfigService;

describe('reminder retry policy', () => {
  it('defaults to 3 retries after 1, 5 and 15 minutes', () => {
    const policy = retryPolicyFrom(config());
    expect(policy).toEqual({ delaysMs: [60_000, 300_000, 900_000], attempts: 4 });
    expect([1, 2, 3].map((n) => backoffDelay(policy, n))).toEqual([60_000, 300_000, 900_000]);
  });

  it('is configurable', () => {
    const policy = retryPolicyFrom(config('10,20'));
    expect(policy.attempts).toBe(3);
    expect(backoffDelay(policy, 2)).toBe(20);
    expect(backoffDelay(policy, 5)).toBe(20);
  });
});
