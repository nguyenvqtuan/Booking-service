import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { RefreshToken, User, UserSalon } from '../src/database/entities/index.js';
import { findOrphans } from '../src/database/implicit-relations.js';
import { deleteSalonData } from '../src/salons/salon-deletion.service.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

describe('multiple branches (e2e)', () => {
  let t: TestApp;
  const salonIds = new Set<string>();

  const http = () => request(t.app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const cookieOf = (res: request.Response) =>
    ([] as string[])
      .concat(res.headers['set-cookie'] ?? [])
      .find((c) => c.startsWith('bs_refresh='))!
      .split(';')[0];

  /** Signs up an owner, then creates a second branch. */
  async function ownerWithTwoBranches() {
    const email = `branches-${randomUUID()}@example.com`;
    const reg = await http()
      .post('/auth/register')
      .send({ salonName: 'Chi nhánh 1', fullName: 'Owner', email, password: 'correct-horse-1' })
      .expect(201);
    const token = reg.body.accessToken as string;
    const first = reg.body.user.salonId as string;
    salonIds.add(first);
    const second = await http()
      .post('/salons')
      .set(bearer(token))
      .send({ name: 'Chi nhánh 2' })
      .expect(201);
    salonIds.add(second.body.id);
    return { token, first, second: second.body.id as string, cookie: cookieOf(reg), email };
  }

  const createService = (token: string, name: string) =>
    http()
      .post('/services')
      .set(bearer(token))
      .send({ name, durationMin: 30, price: 0 })
      .expect(201);
  const serviceNames = async (token: string) =>
    (await http().get('/services').set(bearer(token)).expect(200)).body.map(
      (s: { name: string }) => s.name,
    );

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    for (const id of salonIds) await deleteSalonData(t.dataSource.manager, id);
    await t.app.close();
  });

  it('lists the salons of the user with their role', async () => {
    const { token } = await ownerWithTwoBranches();
    const res = await http().get('/salons').set(bearer(token)).expect(200);
    expect(res.body.map((s: { name: string; role: string }) => [s.name, s.role])).toEqual([
      ['Chi nhánh 1', 'owner'],
      ['Chi nhánh 2', 'owner'],
    ]);
    const me = await http().get('/auth/me').set(bearer(token)).expect(200);
    expect(me.body.salons).toHaveLength(2);
    expect(me.body.salonName).toBe('Chi nhánh 1');
  });

  it('switching shows exactly the data of the selected branch, both ways', async () => {
    const { token, second, first } = await ownerWithTwoBranches();
    await createService(token, 'Dịch vụ CN1');

    const toSecond = await http()
      .post('/auth/switch-salon')
      .set(bearer(token))
      .send({ salonId: second })
      .expect(200);
    expect(toSecond.body.user).toMatchObject({ salonId: second, salonName: 'Chi nhánh 2' });
    const tokenSecond = toSecond.body.accessToken;
    expect(await serviceNames(tokenSecond)).toEqual([]);
    await createService(tokenSecond, 'Dịch vụ CN2');
    expect(await serviceNames(tokenSecond)).toEqual(['Dịch vụ CN2']);

    const back = await http()
      .post('/auth/switch-salon')
      .set(bearer(tokenSecond))
      .send({ salonId: first })
      .expect(200);
    expect(await serviceNames(back.body.accessToken)).toEqual(['Dịch vụ CN1']);
  });

  it('new branches get default reminder settings', async () => {
    const { token, second } = await ownerWithTwoBranches();
    const sw = await http()
      .post('/auth/switch-salon')
      .set(bearer(token))
      .send({ salonId: second })
      .expect(200);
    const res = await http().get('/reminder-settings').set(bearer(sw.body.accessToken)).expect(200);
    expect(res.body.offsets).toEqual([1440, 120]);
  });

  it('cannot switch to a salon the user does not belong to', async () => {
    const a = await ownerWithTwoBranches();
    const b = await ownerWithTwoBranches();
    await http()
      .post('/auth/switch-salon')
      .set(bearer(a.token))
      .send({ salonId: b.first })
      .expect(404);
    await http()
      .post('/auth/switch-salon')
      .set(bearer(a.token))
      .send({ salonId: randomUUID() })
      .expect(404);
    await http().post('/auth/switch-salon').send({ salonId: b.first }).expect(401);
    await http().post('/auth/switch-salon').set(bearer(a.token)).send({ salonId: 'x' }).expect(400);
  });

  it('keeps the selected branch across a token refresh of that session only', async () => {
    const { token, second, cookie, email } = await ownerWithTwoBranches();
    const otherDevice = await http()
      .post('/auth/login')
      .send({ email, password: 'correct-horse-1' })
      .expect(200);

    await http()
      .post('/auth/switch-salon')
      .set(bearer(token))
      .set('Cookie', cookie)
      .send({ salonId: second })
      .expect(200);

    const refreshed = await http().post('/auth/refresh').set('Cookie', cookie).expect(200);
    expect(refreshed.body.user.salonId).toBe(second);
    const again = await http().post('/auth/refresh').set('Cookie', cookieOf(refreshed)).expect(200);
    expect(again.body.user.salonId).toBe(second);

    const other = await http()
      .post('/auth/refresh')
      .set('Cookie', cookieOf(otherDevice))
      .expect(200);
    expect(other.body.user.salonName).toBe('Chi nhánh 1');
  });

  it('falls back to the home salon after losing access to the selected branch', async () => {
    const { token, first, second, cookie } = await ownerWithTwoBranches();
    await http()
      .post('/auth/switch-salon')
      .set(bearer(token))
      .set('Cookie', cookie)
      .send({ salonId: second })
      .expect(200);
    await t.dataSource.getRepository(UserSalon).delete({ salonId: second });

    const refreshed = await http().post('/auth/refresh').set('Cookie', cookie).expect(200);
    expect(refreshed.body.user.salonId).toBe(first);
  });

  it('existing users were backfilled: login works with a membership row', async () => {
    const { email, first } = await ownerWithTwoBranches();
    const user = await t.dataSource.getRepository(User).findOneByOrFail({ email });
    expect(
      await t.dataSource.getRepository(UserSalon).findOneBy({ userId: user.id, salonId: first }),
    ).toMatchObject({ role: 'owner' });
  });

  describe('deleting a salon', () => {
    it('keeps a user who has another branch and moves them there', async () => {
      const { token, first, second, cookie, email } = await ownerWithTwoBranches();
      await http()
        .post('/auth/switch-salon')
        .set(bearer(token))
        .set('Cookie', cookie)
        .send({ salonId: first })
        .expect(200);

      await deleteSalonData(t.dataSource.manager, first);
      salonIds.delete(first);

      const user = await t.dataSource.getRepository(User).findOneByOrFail({ email });
      expect(user.salonId).toBe(second);
      const login = await http()
        .post('/auth/login')
        .send({ email, password: 'correct-horse-1' })
        .expect(200);
      expect(login.body.user.salons.map((s: { id: string }) => s.id)).toEqual([second]);
      expect(await findOrphans(t.dataSource)).toEqual([]);
    });

    it('deletes a user whose only salon is removed', async () => {
      const email = `single-${randomUUID()}@example.com`;
      const reg = await http()
        .post('/auth/register')
        .send({ salonName: 'Duy nhất', fullName: 'Owner', email, password: 'correct-horse-1' })
        .expect(201);
      await deleteSalonData(t.dataSource.manager, reg.body.user.salonId);
      expect(await t.dataSource.getRepository(User).countBy({ email })).toBe(0);
      expect(
        await t.dataSource.getRepository(RefreshToken).countBy({ salonId: reg.body.user.salonId }),
      ).toBe(0);
      expect(await findOrphans(t.dataSource)).toEqual([]);
    });
  });
});
