import { randomUUID } from 'node:crypto';
import { ErrorCode } from '@booking/shared';
import { Appointment, Customer, Staff } from '../src/database/entities/index.js';
import { OwnerFactory, type TestOwner } from './utils/owners.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

describe('services CRUD (e2e)', () => {
  let t: TestApp;
  let owners: OwnerFactory;
  let a: TestOwner;
  let b: TestOwner;

  const cut = { name: 'Cắt tóc', durationMin: 30, price: 100000 };

  beforeAll(async () => {
    t = await createTestApp();
    owners = new OwnerFactory(t);
    [a, b] = await Promise.all([owners.create(), owners.create()]);
  });

  afterAll(async () => {
    await owners.cleanup();
    await t.app.close();
  });

  it('creates, lists, updates and hides a service', async () => {
    const created = await a.post('/services').send(cut).expect(201);
    expect(created.body).toMatchObject({ ...cut, isActive: true, id: expect.any(String) });

    const updated = await a
      .patch(`/services/${created.body.id}`)
      .send({ price: 120000 })
      .expect(200);
    expect(updated.body.price).toBe(120000);

    await a.patch(`/services/${created.body.id}`).send({ isActive: false }).expect(200);
    const visible = await a.get('/services').expect(200);
    expect(visible.body.map((s: { id: string }) => s.id)).not.toContain(created.body.id);
    const all = await a.get('/services?includeInactive=true').expect(200);
    expect(all.body.find((s: { id: string }) => s.id === created.body.id).isActive).toBe(false);
  });

  it.each([
    [{ ...cut, durationMin: 0 }, 'durationMin'],
    [{ ...cut, durationMin: -15 }, 'durationMin'],
    [{ ...cut, price: -1 }, 'price'],
    [{ ...cut, name: '   ' }, 'name'],
  ])('rejects invalid input %j', async (body, field) => {
    const res = await a.post('/services').send(body).expect(400);
    expect(res.body.code).toBe(ErrorCode.ValidationFailed);
    expect(res.body.fields[field]).toBeDefined();
  });

  it('rejects an empty update', async () => {
    const { body } = await a.post('/services').send(cut).expect(201);
    await a.patch(`/services/${body.id}`).send({}).expect(400);
  });

  it('hard-deletes an unused service', async () => {
    const { body } = await a.post('/services').send(cut).expect(201);
    await a.delete(`/services/${body.id}`).expect(204);
    const all = await a.get('/services?includeInactive=true').expect(200);
    expect(all.body.map((s: { id: string }) => s.id)).not.toContain(body.id);
  });

  it('refuses to hard-delete a service that has appointments', async () => {
    const { body: service } = await a.post('/services').send(cut).expect(201);
    const staff = await t.dataSource.getRepository(Staff).save({ salonId: a.salonId, name: 'S' });
    const customer = await t.dataSource
      .getRepository(Customer)
      .save({ salonId: a.salonId, name: 'C', phone: '+84900000123' });
    await t.dataSource.getRepository(Appointment).insert({
      salonId: a.salonId,
      serviceId: service.id,
      staffId: staff.id,
      customerId: customer.id,
      startAt: new Date('2030-01-01T08:00:00Z'),
      endAt: new Date('2030-01-01T08:30:00Z'),
    });

    const res = await a.delete(`/services/${service.id}`).expect(409);
    expect(res.body.code).toBe(ErrorCode.ServiceInUse);
  });

  describe('tenant isolation', () => {
    it("cannot see, update or delete another salon's service", async () => {
      const { body } = await b.post('/services').send(cut).expect(201);

      const list = await a.get('/services?includeInactive=true').expect(200);
      expect(list.body.map((s: { id: string }) => s.id)).not.toContain(body.id);
      await a.patch(`/services/${body.id}`).send({ price: 1 }).expect(404);
      await a.delete(`/services/${body.id}`).expect(404);

      const untouched = await b.get('/services').expect(200);
      expect(untouched.body.find((s: { id: string }) => s.id === body.id).price).toBe(cut.price);
    });

    it('returns 404 for unknown ids and 400 for malformed ids', async () => {
      await a.patch(`/services/${randomUUID()}`).send({ price: 1 }).expect(404);
      await a.patch('/services/not-a-uuid').send({ price: 1 }).expect(400);
    });
  });

  it('requires authentication', async () => {
    const res = await a.get('/services').set('Authorization', '').expect(401);
    expect(res.body.code).toBe(ErrorCode.Unauthorized);
  });
});
