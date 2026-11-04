import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import { ErrorCode } from '@booking/shared';
import { AppException } from '../common/app.exception.js';
import { SendOutcome, SMS_PROVIDER, type SmsProvider } from '../messaging/message-provider.js';
import { REDIS_CLIENT } from '../queue/queue.constants.js';

const CODE_TTL_SEC = 5 * 60;
const RESEND_COOLDOWN_SEC = 60;
const LOCK_SEC = 15 * 60;
const MAX_ATTEMPTS = 5;
const DEFAULT_TEMPLATE = 'Ma xac thuc dat lich cua ban la {code}. Hieu luc 5 phut.';

const rateLimited = (code: ErrorCode, message: string) =>
  new AppException(HttpStatus.TOO_MANY_REQUESTS, code, message);

const invalid = () =>
  new AppException(HttpStatus.BAD_REQUEST, ErrorCode.OtpInvalid, 'Incorrect or expired code', {
    otp: ['Incorrect or expired code'],
  });

/** Optional phone verification for online booking (BS-38). Codes are stored hashed in Redis. */
@Injectable()
export class OtpService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    private readonly config: ConfigService,
  ) {}

  async request(salonId: string, phone: string): Promise<void> {
    const keys = this.keys(salonId, phone);
    await this.assertNotLocked(keys.lock);
    // SMS costs money: one code per phone per minute.
    const free = await this.redis.set(keys.cooldown, '1', 'EX', RESEND_COOLDOWN_SEC, 'NX');
    if (!free) throw rateLimited(ErrorCode.OtpCooldown, 'Please wait before requesting a new code');

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.redis
      .multi()
      .del(keys.code)
      .hset(keys.code, { hash: this.hash(keys.code, code), attempts: '0' })
      .expire(keys.code, CODE_TTL_SEC)
      .exec();

    const template = this.config.get<string>('SMS_OTP_TEMPLATE') ?? DEFAULT_TEMPLATE;
    const result = await this.sms.sendText(phone, template.replace('{code}', code));
    if (result.outcome !== SendOutcome.Success) {
      await this.redis.del(keys.code, keys.cooldown);
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.ServiceUnavailable,
        'Could not send the verification code',
      );
    }
  }

  /** Throws unless `code` is right. A correct code works once; too many errors lock the phone. */
  async verify(salonId: string, phone: string, code: string | undefined): Promise<void> {
    const keys = this.keys(salonId, phone);
    await this.assertNotLocked(keys.lock);
    if (!code) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.OtpRequired,
        'Verification required',
        {
          otp: ['Required'],
        },
      );
    }
    const stored = await this.redis.hget(keys.code, 'hash');
    if (!stored) throw invalid();

    const expected = Buffer.from(stored);
    const actual = Buffer.from(this.hash(keys.code, code));
    if (expected.length === actual.length && timingSafeEqual(expected, actual)) {
      // DEL returns 0 for the loser when the same code is submitted twice at once.
      if ((await this.redis.del(keys.code)) === 0) throw invalid();
      return;
    }

    const attempts = await this.redis.hincrby(keys.code, 'attempts', 1);
    if (attempts >= MAX_ATTEMPTS) {
      await this.redis.multi().set(keys.lock, '1', 'EX', LOCK_SEC).del(keys.code).exec();
      throw rateLimited(ErrorCode.OtpLocked, 'Too many incorrect codes, try again later');
    }
    throw invalid();
  }

  private async assertNotLocked(lockKey: string): Promise<void> {
    if (await this.redis.exists(lockKey)) {
      throw rateLimited(ErrorCode.OtpLocked, 'Too many incorrect codes, try again later');
    }
  }

  private keys(salonId: string, phone: string) {
    const base = `otp:${salonId}:${phone}`;
    return { code: base, cooldown: `${base}:cooldown`, lock: `${base}:lock` };
  }

  private hash(salt: string, code: string): string {
    return createHash('sha256').update(`${salt}:${code}`).digest('hex');
  }
}
