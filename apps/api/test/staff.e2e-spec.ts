import { randomUUID } from 'node:crypto';
import { ErrorCode } from '@booking/shared';
import { Appointment, Customer, StaffService } from '../src/database/entities/index.js';
import { findOrphans } from '../src/database/implicit-relations.js';
import { OwnerFactory, type TestOwner } from './utils/owners.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

describe('staff CRUD (e2e)', () => {
  let t: TestApp;
  let owners: OwnerFactory;
  let a: TestOwner;
  let b: TestOwner;
  let cutId: string;
  let nailId: string;

  const splitMonday = {
    mon: [
      { start: '13:30', end: '20:00' },
      { start: '09:00', end: '12:00' },
    ],
    sun: [],
  };

  beforeAll(async () => {
    t = await createTestApp();
    owners = new OwnerFactory(t);
    [a, b] = await Promise.all([owners.create(), owners.create()]);
    cutId = (await a.post('/services').send({ name: 'Cut', durationMin: 30, price: 0 })).body.id;
    nailId = (await a.post('/services').send({ name: 'Nail', durationMin: 60, price: 0 })).body.id;
  });

  afterAll(async () => {
    await owners.cleanup();
    await t.app.close();
  });

  it('creates staff with multiple shifts per day, days off and services', async () => {
    const res = await a
      .post('/staff')
      .send({
        name: 'An',
        phone: '0901234567',
        workingHours: splitMonday,
        serviceIds: [cutId, nailId],
      })
      .expect(201);

    expect(res.body.workingHours.mon).toEqual([
      { start: '09:00', end: '12:00' },
      { start: '13:30', end: '20:00' },
    ]);
    expect(res.body.workingHours.sun).toEqual([]);
    expect(res.body.workingHours.tue).toEqual([]);
    expect(res.body.serviceIds).toEqual([cutId, nailId].sort());

    const fetched = await a.get(`/staff/${res.body.id}`).expect(200);
    expect(fetched.body).toEqual(res.body);
  });

  it('updates working hours and replaces services', async () => {
    const { body } = await a
      .post('/staff')
      .send({ name: 'Binh', workingHours: {}, serviceIds: [cutId] })
      .expect(201);
    const updated = await a
      .patch(`/staff/${body.id}`)
      .send({ workingHours: { sat: [{ start: '08:00', end: '21:00' }] }, serviceIds: [nailId] })
      .expect(200);
    expect(updated.body.workingHours.sat).toEqual([{ start: '08:00', end: '21:00' }]);
    expect(updated.body.serviceIds).toEqual([nailId]);

    const nameOnly = await a.patch(`/staff/${body.id}`).send({ name: 'Bình' }).expect(200);
    expect(nameOnly.body.serviceIds).toEqual([nailId]);
  });

  it('rejects overlapping shifts and invalid times', async () => {
    const res = await a
      .post('/staff')
      .send({
        name: 'X',
        workingHours: {
          mon: [
            { start: '09:00', end: '13:00' },
            { start: '12:00', end: '18:00' },
          ],
        },
      })
      .expect(400);
    expect(res.body.fields['workingHours.mon']).toBeDefined();
    await a
      .post('/staff')
      .send({ name: 'X', workingHours: { mon: [{ start: '18:00', end: '09:00' }] } })
      .expect(400);
  });

  it('rejects services of another salon', async () => {
    const foreign = (await b.post('/services').send({ name: 'B', durationMin: 30, price: 0 })).body
      .id;
    const res = await a
      .post('/staff')
      .send({ name: 'X', workingHours: {}, serviceIds: [foreign] })
      .expect(400);
    expect(res.body.fields.serviceIds).toBeDefined();
  });

  it('deactivates and hides staff from the default list', async () => {
    const { body } = await a.post('/staff').send({ name: 'Off', workingHours: {} }).expect(201);
    await a.patch(`/staff/${body.id}`).send({ isActive: false }).expect(200);
    const active = await a.get('/staff').expect(200);
    expect(active.body.map((s: { id: string }) => s.id)).not.toContain(body.id);
    const all = await a.get('/staff?includeInactive=true').expect(200);
    expect(all.body.map((s: { id: string }) => s.id)).toContain(body.id);
  });

  it('refuses to delete staff with appointments', async () => {
    const { body: staff } = await a
      .post('/staff')
      .send({ name: 'Busy', workingHours: {} })
      .expect(201);
    const customer = await t.dataSource
      .getRepository(Customer)
      .save({ salonId: a.salonId, name: 'C', phone: '+84900000456' });
    await t.dataSource.getRepository(Appointment).insert({
      salonId: a.salonId,
      staffId: staff.id,
      serviceId: cutId,
      customerId: customer.id,
      startAt: new Date('2030-01-01T08:00:00Z'),
      endAt: new Date('2030-01-01T08:30:00Z'),
    });
    const res = await a.delete(`/staff/${staff.id}`).expect(409);
    expect(res.body.code).toBe(ErrorCode.StaffInUse);

    const { body: idle } = await a
      .post('/staff')
      .send({ name: 'Idle', workingHours: {} })
      .expect(201);
    await a.delete(`/staff/${idle.id}`).expect(204);
  });

  it('removes staff_services links when a staff member or a service is deleted (no FK cascade)', async () => {
    const { body: svc } = await a
      .post('/services')
      .send({ name: 'Tmp', durationMin: 30, price: 0 });
    const { body: st1 } = await a
      .post('/staff')
      .send({ name: 'L1', workingHours: {}, serviceIds: [svc.id, cutId] });
    const { body: st2 } = await a
      .post('/staff')
      .send({ name: 'L2', workingHours: {}, serviceIds: [svc.id] });
    const links = t.dataSource.getRepository(StaffService);

    await a.delete(`/staff/${st1.id}`).expect(204);
    expect(await links.countBy({ staffId: st1.id })).toBe(0);

    await a.delete(`/services/${svc.id}`).expect(204);
    expect(await links.countBy({ serviceId: svc.id })).toBe(0);
    const remaining = await a.get(`/staff/${st2.id}`).expect(200);
    expect(remaining.body.serviceIds).toEqual([]);
    expect(await findOrphans(t.dataSource)).toEqual([]);
  });

  it("isolates salons: another salon's staff is invisible and untouchable", async () => {
    const { body } = await b.post('/staff').send({ name: 'B staff', workingHours: {} }).expect(201);
    const list = await a.get('/staff?includeInactive=true').expect(200);
    expect(list.body.map((s: { id: string }) => s.id)).not.toContain(body.id);
    await a.get(`/staff/${body.id}`).expect(404);
    await a.patch(`/staff/${body.id}`).send({ name: 'hacked' }).expect(404);
    await a.delete(`/staff/${body.id}`).expect(404);
    await a.get(`/staff/${randomUUID()}`).expect(404);
  });
});
