import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { ErrorCode } from '@booking/shared';
import { ReminderSetting, User } from '../src/database/entities/index.js';
import { deleteSalonData } from '../src/salons/salon-deletion.service.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

const PASSWORD = 'correct-horse-1';

describe('auth (e2e)', () => {
  let t: TestApp;
  const createdSalonIds: string[] = [];

  const http = () => request(t.app.getHttpServer());
  const newEmail = () => `owner-${randomUUID()}@example.com`;

  /** Extracts "bs_refresh=<value>" from a response's Set-Cookie header. */
  const refreshCookie = (res: request.Response): string => {
    const header = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    const cookie = header.find((c) => c.startsWith('bs_refresh='));
    if (!cookie) throw new Error('refresh cookie not set');
    return cookie.split(';')[0];
  };

  const register = async (email = newEmail(), password = PASSWORD) => {
    const res = await http()
      .post('/auth/register')
      .send({ salonName: 'Tiệm Tóc Đẹp', fullName: 'Chủ Tiệm', email, password })
      .expect(201);
    createdSalonIds.push(res.body.user.salonId);
    return { res, email };
  };

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    for (const id of createdSalonIds) await deleteSalonData(t.dataSource.manager, id);
    await t?.app.close();
  });

  describe('register', () => {
    it('creates salon + owner, returns an access token and sets an httpOnly refresh cookie', async () => {
      const { res, email } = await register();
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.expiresIn).toBe(900);
      expect(res.body.user).toMatchObject({
        email,
        fullName: 'Chủ Tiệm',
        salonName: 'Tiệm Tóc Đẹp',
      });
      expect(res.body.user.salonSlug).toMatch(/^tiem-toc-dep(-\d+)?$/);

      const cookie = ([] as string[]).concat(res.headers['set-cookie']).join(';');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Path=/auth');

      const settings = await t.dataSource
        .getRepository(ReminderSetting)
        .findOneByOrFail({ salonId: res.body.user.salonId });
      expect(settings.offsets).toEqual([1440, 120]);
    });

    it('stores only a bcrypt hash of the password', async () => {
      const { email } = await register();
      const user = await t.dataSource.getRepository(User).findOneByOrFail({ email });
      expect(user.passwordHash).not.toContain(PASSWORD);
      expect(user.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
    });

    it('normalizes email case and rejects duplicates with AUTH_EMAIL_TAKEN', async () => {
      const { email } = await register();
      const res = await http()
        .post('/auth/register')
        .send({
          salonName: 'Khác',
          fullName: 'Khác',
          email: email.toUpperCase(),
          password: PASSWORD,
        })
        .expect(409);
      expect(res.body.code).toBe(ErrorCode.AuthEmailTaken);
    });

    it('handles concurrent sign-ups with the same salon name (unique slugs, no 500)', async () => {
      const results = await Promise.all(
        Array.from({ length: 4 }, () =>
          http().post('/auth/register').send({
            salonName: 'Tiệm Đồng Thời',
            fullName: 'Owner',
            email: newEmail(),
            password: PASSWORD,
          }),
        ),
      );
      expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201]);
      results.forEach((r) => createdSalonIds.push(r.body.user.salonId));
      const slugs = results.map((r) => r.body.user.salonSlug);
      expect(new Set(slugs).size).toBe(4);
    });

    it('returns 409 (not 500) for concurrent sign-ups with the same email', async () => {
      const email = newEmail();
      const results = await Promise.all(
        [1, 2].map(() =>
          http()
            .post('/auth/register')
            .send({ salonName: 'Dup', fullName: 'Owner', email, password: PASSWORD }),
        ),
      );
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      results
        .filter((r) => r.status === 201)
        .forEach((r) => createdSalonIds.push(r.body.user.salonId));
    });

    it('gives each salon a unique slug', async () => {
      const a = await register();
      const b = await register();
      expect(a.res.body.user.salonSlug).not.toBe(b.res.body.user.salonSlug);
    });

    it('returns VALIDATION_FAILED with field errors for invalid input', async () => {
      const res = await http()
        .post('/auth/register')
        .send({ salonName: 'A', fullName: 'B', email: 'not-an-email', password: 'short' })
        .expect(400);
      expect(res.body.code).toBe(ErrorCode.ValidationFailed);
      expect(Object.keys(res.body.fields)).toEqual(
        expect.arrayContaining(['salonName', 'fullName', 'email', 'password']),
      );
    });
  });

  describe('login and protected routes', () => {
    it('logs in and can call GET /auth/me right away', async () => {
      const { email } = await register();
      const login = await http()
        .post('/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);
      const me = await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(200);
      expect(me.body.email).toBe(email);
    });

    it('rejects a wrong password and an unknown email with the same error', async () => {
      const { email } = await register();
      const wrong = await http()
        .post('/auth/login')
        .send({ email, password: 'nope-nope' })
        .expect(401);
      const unknown = await http()
        .post('/auth/login')
        .send({ email: newEmail(), password: PASSWORD })
        .expect(401);
      expect(wrong.body.code).toBe(ErrorCode.AuthInvalidCredentials);
      expect(unknown.body.code).toBe(ErrorCode.AuthInvalidCredentials);
    });

    it('requires a token by default (global guard)', async () => {
      const res = await http().get('/auth/me').expect(401);
      expect(res.body.code).toBe(ErrorCode.Unauthorized);
    });

    it('rejects an expired access token', async () => {
      const { res } = await register();
      const expired = new JwtService({ secret: process.env.JWT_ACCESS_SECRET }).sign({
        sub: res.body.user.id,
        salonId: res.body.user.salonId,
        exp: Math.floor(Date.now() / 1000) - 10,
      });
      await http().get('/auth/me').set('Authorization', `Bearer ${expired}`).expect(401);
    });

    it('keeps public routes open', async () => {
      await http().get('/health').expect(200);
    });
  });

  describe('profile locale', () => {
    it('defaults to vi, accepts a locale at registration and can be updated', async () => {
      const { res } = await register();
      expect(res.body.user.locale).toBe('vi');

      const en = await http()
        .post('/auth/register')
        .send({
          salonName: 'Salon',
          fullName: 'Owner',
          email: newEmail(),
          password: PASSWORD,
          locale: 'en',
        })
        .expect(201);
      createdSalonIds.push(en.body.user.salonId);
      expect(en.body.user.locale).toBe('en');

      const updated = await http()
        .patch('/auth/me')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .send({ locale: 'en' })
        .expect(200);
      expect(updated.body.locale).toBe('en');
    });

    it('rejects unsupported locales', async () => {
      const { res } = await register();
      const bad = await http()
        .patch('/auth/me')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .send({ locale: 'fr' })
        .expect(400);
      expect(bad.body.fields.locale).toBeDefined();
    });
  });

  describe('refresh token rotation', () => {
    it('issues a new access token and rotates the refresh cookie', async () => {
      const { res } = await register();
      const first = refreshCookie(res);
      const refreshed = await http().post('/auth/refresh').set('Cookie', first).expect(200);
      expect(refreshed.body.accessToken).toEqual(expect.any(String));
      expect(refreshCookie(refreshed)).not.toBe(first);
      await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
        .expect(200);
    });

    /** Makes every revoked token of the test look rotated long ago (past the grace period). */
    const ageRevokedTokens = () =>
      t.dataSource.query(
        `UPDATE refresh_tokens SET revoked_at = now() - interval '1 minute' WHERE revoked_at IS NOT NULL`,
      );

    it('treats a late reuse of a rotated token as theft and revokes the whole family', async () => {
      const { res } = await register();
      const first = refreshCookie(res);
      const second = refreshCookie(
        await http().post('/auth/refresh').set('Cookie', first).expect(200),
      );
      await ageRevokedTokens();
      const reuse = await http().post('/auth/refresh').set('Cookie', first).expect(401);
      expect(reuse.body.code).toBe(ErrorCode.AuthInvalidRefreshToken);
      await http().post('/auth/refresh').set('Cookie', second).expect(401);
    });

    it('survives a lost response: a just-rotated token still works (page reload, other tab)', async () => {
      const { res } = await register();
      const first = refreshCookie(res);
      const lost = await http().post('/auth/refresh').set('Cookie', first).expect(200);
      // The browser never stored the new cookie and sends the old one again.
      const retry = await http().post('/auth/refresh').set('Cookie', first).expect(200);
      await http().post('/auth/refresh').set('Cookie', refreshCookie(retry)).expect(200);
      await http().post('/auth/refresh').set('Cookie', refreshCookie(lost)).expect(200);
    });

    it('does not lose the session when two refreshes run at once', async () => {
      const { res } = await register();
      const cookie = refreshCookie(res);
      const results = await Promise.all([
        http().post('/auth/refresh').set('Cookie', cookie),
        http().post('/auth/refresh').set('Cookie', cookie),
      ]);
      expect(results.map((r) => r.status)).toEqual([200, 200]);
    });

    it('the grace period cannot revive a session that was logged out', async () => {
      const { res } = await register();
      const first = refreshCookie(res);
      const second = refreshCookie(
        await http().post('/auth/refresh').set('Cookie', first).expect(200),
      );
      await http().post('/auth/logout').set('Cookie', second).expect(204);
      await http().post('/auth/refresh').set('Cookie', first).expect(401);
      await http().post('/auth/refresh').set('Cookie', second).expect(401);
    });

    it('the grace period cannot revive a session after a password reset', async () => {
      const { res, email } = await register();
      const first = refreshCookie(res);
      await http().post('/auth/refresh').set('Cookie', first).expect(200);
      await http().post('/auth/forgot-password').send({ email }).expect(204);
      const message = [...t.mail.sent].reverse().find((m) => m.to === email)!;
      const token = message.text.match(/token=([\w-]+)/)![1];
      await http()
        .post('/auth/reset-password')
        .send({ token, password: 'brand-new-pass-2' })
        .expect(204);
      await http().post('/auth/refresh').set('Cookie', first).expect(401);
    });

    it('returns 401 without a cookie', async () => {
      const res = await http().post('/auth/refresh').expect(401);
      expect(res.body.code).toBe(ErrorCode.AuthInvalidRefreshToken);
    });

    it('logout revokes the refresh token', async () => {
      const { res } = await register();
      const cookie = refreshCookie(res);
      await http().post('/auth/logout').set('Cookie', cookie).expect(204);
      await http().post('/auth/refresh').set('Cookie', cookie).expect(401);
    });
  });

  describe('forgot / reset password', () => {
    const lastResetToken = (email: string) => {
      const message = [...t.mail.sent].reverse().find((m) => m.to === email);
      const token = message?.text.match(/token=([\w-]+)/)?.[1];
      if (!token) throw new Error('no reset email captured');
      return token;
    };

    it('does not reveal whether an email exists', async () => {
      const before = t.mail.sent.length;
      await http().post('/auth/forgot-password').send({ email: newEmail() }).expect(204);
      expect(t.mail.sent.length).toBe(before);
    });

    it('resets the password once, revokes sessions and rejects token reuse', async () => {
      const { res, email } = await register();
      const oldRefresh = refreshCookie(res);

      await http().post('/auth/forgot-password').send({ email }).expect(204);
      const token = lastResetToken(email);

      const newPassword = 'brand-new-pass-2';
      await http().post('/auth/reset-password').send({ token, password: newPassword }).expect(204);

      await http().post('/auth/login').send({ email, password: PASSWORD }).expect(401);
      await http().post('/auth/login').send({ email, password: newPassword }).expect(200);
      await http().post('/auth/refresh').set('Cookie', oldRefresh).expect(401);

      const reuse = await http()
        .post('/auth/reset-password')
        .send({ token, password: 'another-pass-3' })
        .expect(400);
      expect(reuse.body.code).toBe(ErrorCode.AuthInvalidResetToken);
    });
  });
});
