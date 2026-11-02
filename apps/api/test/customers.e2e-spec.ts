import { randomUUID } from 'node:crypto';
import { ErrorCode } from '@booking/shared';
import { Appointment, Customer } from '../src/database/entities/index.js';
import { pgErrorCode } from './utils/test-data-source.js';
import { OwnerFactory, type TestOwner } from './utils/owners.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

describe('customers CRUD (e2e)', () => {
  let t: TestApp;
  let owners: OwnerFactory;
  let a: TestOwner;
  let b: TestOwner;

  beforeAll(async () => {
    t = await createTestApp();
    owners = new OwnerFactory(t);
    [a, b] = await Promise.all([owners.create(), owners.create()]);
  });

  afterAll(async () => {
    await owners.cleanup();
    await t.app.close();
  });

  describe('phone normalization (BS-66)', () => {
    it.each(['0901234567', '84901234567', '090 123 4567', '+84 90.123.4567'])(
      'stores %s as +84901234567',
      async (phone) => {
        const owner = await owners.create();
        const res = await owner.post('/customers').send({ name: 'Chi', phone }).expect(201);
        expect(res.body.phone).toBe('+84901234567');
      },
    );

    it('rejects an invalid phone', async () => {
      const res = await a.post('/customers').send({ name: 'X', phone: '12345' }).expect(400);
      expect(res.body.fields.phone).toBeDefined();
    });

    it('enforces E.164 in the database too', async () => {
      const code = await pgErrorCode(
        t.dataSource
          .getRepository(Customer)
          .insert({ salonId: a.salonId, name: 'X', phone: '0901' }),
      );
      expect(code).toBe('23514');
    });
  });

  it('blocks a duplicate phone in the same salon, in any format', async () => {
    await a.post('/customers').send({ name: 'Lan', phone: '0912345678' }).expect(201);
    const dup = await a
      .post('/customers')
      .send({ name: 'Lan 2', phone: '+84 912 345 678' })
      .expect(409);
    expect(dup.body.code).toBe(ErrorCode.CustomerPhoneTaken);
    // ...but another salon may have the same customer.
    await b.post('/customers').send({ name: 'Lan', phone: '0912345678' }).expect(201);
  });

  it('blocks changing a phone to one that is already used', async () => {
    await a.post('/customers').send({ name: 'P1', phone: '0933000001' }).expect(201);
    const { body } = await a
      .post('/customers')
      .send({ name: 'P2', phone: '0933000002' })
      .expect(201);
    const res = await a.patch(`/customers/${body.id}`).send({ phone: '0933000001' }).expect(409);
    expect(res.body.code).toBe(ErrorCode.CustomerPhoneTaken);
  });

  describe('search', () => {
    let owner: TestOwner;

    beforeAll(async () => {
      owner = await owners.create();
      for (const c of [
        { name: 'Nguyễn Văn An', phone: '0901111111' },
        { name: 'Trần Thị Bình', phone: '0902222222' },
        { name: 'Lê Chi', phone: '0973333333' },
      ]) {
        await owner.post('/customers').send(c).expect(201);
      }
    });

    it.each([
      ['nguyen', ['Nguyễn Văn An']],
      ['Bình', ['Trần Thị Bình']],
      ['binh', ['Trần Thị Bình']],
      ['0902', ['Trần Thị Bình']],
      ['097 333', ['Lê Chi']],
      ['+84901111111', ['Nguyễn Văn An']],
      ['%', []],
    ])('q=%j finds %j', async (q, names) => {
      const res = await owner.get('/customers').query({ q }).expect(200);
      expect(res.body.items.map((c: { name: string }) => c.name)).toEqual(names);
      expect(res.body.total).toBe(names.length);
    });

    it('paginates', async () => {
      const page = await owner.get('/customers').query({ limit: 2, offset: 0 }).expect(200);
      expect(page.body.items).toHaveLength(2);
      expect(page.body.total).toBe(3);
      const next = await owner.get('/customers').query({ limit: 2, offset: 2 }).expect(200);
      expect(next.body.items).toHaveLength(1);
    });
  });

  it('returns no-show count and appointment history', async () => {
    const { body: customer } = await a
      .post('/customers')
      .send({ name: 'Hist', phone: '0944000001' })
      .expect(201);
    const { body: service } = await a
      .post('/services')
      .send({ name: 'Cut', durationMin: 30, price: 0 });
    const { body: staff } = await a.post('/staff').send({ name: 'An', workingHours: {} });
    await t.dataSource.getRepository(Appointment).insert({
      salonId: a.salonId,
      customerId: customer.id,
      serviceId: service.id,
      staffId: staff.id,
      startAt: new Date('2030-01-01T08:00:00Z'),
      endAt: new Date('2030-01-01T08:30:00Z'),
    });
    await t.dataSource.getRepository(Customer).update({ id: customer.id }, { noShowCount: 2 });

    const res = await a.get(`/customers/${customer.id}`).expect(200);
    expect(res.body.noShowCount).toBe(2);
    expect(res.body.history).toEqual([
      expect.objectContaining({
        startAt: '2030-01-01T08:00:00.000Z',
        status: 'booked',
        serviceName: 'Cut',
        staffName: 'An',
      }),
    ]);

    const del = await a.delete(`/customers/${customer.id}`).expect(409);
    expect(del.body.code).toBe(ErrorCode.CustomerInUse);
  });

  it('updates and deletes a customer without appointments', async () => {
    const { body } = await a
      .post('/customers')
      .send({ name: 'Tmp', phone: '0955000001' })
      .expect(201);
    const updated = await a
      .patch(`/customers/${body.id}`)
      .send({ note: 'VIP', locale: 'en' })
      .expect(200);
    expect(updated.body).toMatchObject({ note: 'VIP', locale: 'en' });
    await a.delete(`/customers/${body.id}`).expect(204);
    await a.get(`/customers/${body.id}`).expect(404);
  });

  it('isolates salons', async () => {
    const { body } = await b
      .post('/customers')
      .send({ name: 'Secret', phone: '0966000001' })
      .expect(201);
    const list = await a.get('/customers').query({ q: 'Secret' }).expect(200);
    expect(list.body.total).toBe(0);
    await a.get(`/customers/${body.id}`).expect(404);
    await a.patch(`/customers/${body.id}`).send({ name: 'x' }).expect(404);
    await a.delete(`/customers/${body.id}`).expect(404);
    await a.get(`/customers/${randomUUID()}`).expect(404);
  });
});
