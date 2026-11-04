import { ErrorCode, localToUtc } from '@booking/shared';
import type { Redis } from 'ioredis';
import request from 'supertest';
import { Salon } from '../src/database/entities/index.js';
import type { FakeProvider } from '../src/messaging/fake.provider.js';
import { SendOutcome, SMS_PROVIDER } from '../src/messaging/message-provider.js';
import { REDIS_CLIENT } from '../src/queue/queue.constants.js';
import { OwnerFactory, type TestOwner } from './utils/owners.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

const VN = 'Asia/Ho_Chi_Minh';
const PHONE = '+84912345678';

describe('anti-spam for public endpoints (e2e)', () => {
  describe('rate limit', () => {
    const original = process.env.PUBLIC_RATE_LIMIT_PER_MIN;
    let t: TestApp;

    beforeAll(async () => {
      process.env.PUBLIC_RATE_LIMIT_PER_MIN = '3';
      t = await createTestApp(); // fresh in-memory counters
    });

    afterAll(async () => {
      process.env.PUBLIC_RATE_LIMIT_PER_MIN = original;
      await t.app.close();
    });

    it('returns 429 RATE_LIMITED above the limit, on public routes only', async () => {
      const http = request(t.app.getHttpServer());
      for (let i = 0; i < 3; i++) await http.get('/public/rate-limit-test').expect(404);
      const res = await http.get('/public/rate-limit-test').expect(429);
      expect(res.body.code).toBe(ErrorCode.RateLimited);

      for (let i = 0; i < 5; i++) await http.get('/health').expect(200);
    });

    it('protects login against brute force', async () => {
      const http = request(t.app.getHttpServer());
      const login = () => http.post('/auth/login').send({ email: 'a@example.com', password: 'x' });
      for (let i = 0; i < 3; i++) await login().expect(401);
      await login().expect(429);
    });
  });

  describe('optional phone verification', () => {
    let t: TestApp;
    let owners: OwnerFactory;
    let a: TestOwner;
    let slug: string;
    let ids: { staffId: string; serviceId: string };
    let sms: FakeProvider;
    let redis: Redis;
    let day = 0;

    const http = () => request(t.app.getHttpServer());
    const nextSlot = () => {
      day++;
      return localToUtc(`2036-03-${String(day).padStart(2, '0')}`, '09:00', VN).toISOString();
    };
    const book = (extra: Record<string, unknown>) =>
      http()
        .post(`/public/${slug}/appointments`)
        .send({ ...ids, name: 'Lan', phone: PHONE, startAt: nextSlot(), ...extra });
    const requestOtp = () => http().post(`/public/${slug}/otp`).send({ phone: '0912345678' });
    const lastCode = () => sms.texts.at(-1)!.content.match(/\d{6}/)![0];
    const wrongCode = () => (lastCode() === '000000' ? '111111' : '000000');
    const clearOtp = async () => {
      const keys = await redis.keys(`otp:${a.salonId}:*`);
      if (keys.length) await redis.del(...keys);
    };

    beforeAll(async () => {
      t = await createTestApp();
      owners = new OwnerFactory(t);
      a = await owners.create();
      slug = (await t.dataSource.getRepository(Salon).findOneByOrFail({ id: a.salonId })).slug;
      const svc = (await a.post('/services').send({ name: 'Cut', durationMin: 30, price: 0 })).body;
      const shift = [{ start: '09:00', end: '12:00' }];
      const week = {
        mon: shift,
        tue: shift,
        wed: shift,
        thu: shift,
        fri: shift,
        sat: shift,
        sun: shift,
      };
      const staff = (
        await a.post('/staff').send({ name: 'An', workingHours: week, serviceIds: [svc.id] })
      ).body;
      ids = { staffId: staff.id, serviceId: svc.id };
      sms = t.app.get(SMS_PROVIDER, { strict: false });
      redis = t.app.get(REDIS_CLIENT, { strict: false });
    });

    beforeEach(clearOtp);

    afterAll(async () => {
      await clearOtp();
      await owners.cleanup();
      await t.app.close();
    });

    it('is off by default: booking needs no code', async () => {
      expect((await a.get('/salon-settings').expect(200)).body).toEqual({
        onlineBookingOtp: false,
      });
      expect((await http().get(`/public/${slug}`).expect(200)).body.otpRequired).toBe(false);
      await book({ phone: '0922000001' }).expect(201);
    });

    describe('when enabled', () => {
      beforeAll(async () => {
        await a.put('/salon-settings').send({ onlineBookingOtp: true }).expect(200);
      });

      it('announces it and refuses a booking without a code', async () => {
        expect((await http().get(`/public/${slug}`).expect(200)).body.otpRequired).toBe(true);
        const res = await book({}).expect(400);
        expect(res.body.code).toBe(ErrorCode.OtpRequired);
      });

      it('books with the right code, which then cannot be reused', async () => {
        await requestOtp().expect(204);
        expect(sms.texts.at(-1)!.to).toBe(PHONE);
        const otp = lastCode();
        await book({ otp }).expect(201);
        const reuse = await book({ otp }).expect(400);
        expect(reuse.body.code).toBe(ErrorCode.OtpInvalid);
      });

      it('stores only a hash of the code in Redis', async () => {
        await requestOtp().expect(204);
        const stored = await redis.hget(`otp:${a.salonId}:${PHONE}`, 'hash');
        expect(stored).toHaveLength(64);
        expect(stored).not.toContain(lastCode());
      });

      it('rejects a code for another phone', async () => {
        await requestOtp().expect(204);
        await book({ otp: lastCode(), phone: '0922000002' }).expect(400);
      });

      it('limits code requests to one per minute per phone', async () => {
        await requestOtp().expect(204);
        const res = await requestOtp().expect(429);
        expect(res.body.code).toBe(ErrorCode.OtpCooldown);
      });

      it('locks the phone after 5 wrong codes, even for the right code', async () => {
        await requestOtp().expect(204);
        const right = lastCode();
        for (let i = 0; i < 4; i++) {
          const wrong = await book({ otp: wrongCode() }).expect(400);
          expect(wrong.body.code).toBe(ErrorCode.OtpInvalid);
        }
        const locked = await book({ otp: wrongCode() }).expect(429);
        expect(locked.body.code).toBe(ErrorCode.OtpLocked);
        await book({ otp: right }).expect(429);
        await requestOtp().expect(429);
      });

      it('reports a failed SMS and allows trying again', async () => {
        sms.respondTo(PHONE, SendOutcome.Transient);
        await requestOtp().expect(503);
        await requestOtp().expect(204);
      });

      it('keeps the code when the time is not available', async () => {
        await requestOtp().expect(204);
        const otp = lastCode();
        const startAt = localToUtc('2036-04-01', '20:00', VN).toISOString();
        await book({ otp, startAt }).expect(409);
        await book({ otp }).expect(201);
      });

      it('validates the code format', async () => {
        await book({ otp: '12' }).expect(400);
      });
    });

    it('settings are tenant scoped', async () => {
      const b = await owners.create();
      expect((await b.get('/salon-settings').expect(200)).body.onlineBookingOtp).toBe(false);
    });
  });
});
