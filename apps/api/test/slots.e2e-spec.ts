import { randomUUID } from 'node:crypto';
import { localToUtc } from '@booking/shared';
import { OwnerFactory, type TestOwner } from './utils/owners.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

const VN = 'Asia/Ho_Chi_Minh';
const MONDAY = '2033-05-02';
const SUNDAY = '2033-05-08';

describe('GET /slots (e2e)', () => {
  let t: TestApp;
  let owners: OwnerFactory;
  let a: TestOwner;
  let b: TestOwner;
  let ids: { staffId: string; serviceId: string };
  let customerId: string;

  const times = async (query: Record<string, string>) =>
    (await a.get('/slots').query(query).expect(200)).body.map((s: { time: string }) => s.time);

  beforeAll(async () => {
    t = await createTestApp();
    owners = new OwnerFactory(t);
    [a, b] = await Promise.all([owners.create(), owners.create()]);
    const svc = (await a.post('/services').send({ name: 'Cut', durationMin: 30, price: 0 })).body;
    const staff = (
      await a.post('/staff').send({
        name: 'An',
        workingHours: { mon: [{ start: '09:00', end: '10:00' }], sun: [] },
        serviceIds: [svc.id],
      })
    ).body;
    customerId = (await a.post('/customers').send({ name: 'Chi', phone: '0901234567' })).body.id;
    ids = { staffId: staff.id, serviceId: svc.id };
  });

  afterAll(async () => {
    await owners.cleanup();
    await t.app.close();
  });

  it('lists free slots within the shift', async () => {
    expect(await times({ ...ids, date: MONDAY })).toEqual(['09:00', '09:15', '09:30']);
  });

  it('returns an empty list on a day off', async () => {
    expect(await times({ ...ids, date: SUNDAY })).toEqual([]);
  });

  it('removes booked times and frees them again after cancellation', async () => {
    const startAt = localToUtc(MONDAY, '09:15', VN).toISOString();
    const { body } = await a
      .post('/appointments')
      .send({ ...ids, customerId, startAt })
      .expect(201);
    // 09:15-09:45 is taken: 09:00 (ends 09:30) and 09:30 (ends 10:00) overlap it.
    expect(await times({ ...ids, date: MONDAY })).toEqual([]);

    await a.post(`/appointments/${body.id}/status`).send({ status: 'cancelled' }).expect(200);
    expect(await times({ ...ids, date: MONDAY })).toEqual(['09:00', '09:15', '09:30']);
  });

  it('never offers past slots', async () => {
    expect(await times({ ...ids, date: '2020-01-06' })).toEqual([]);
  });

  it('returns slots that can really be booked', async () => {
    const [slot] = (
      await a
        .get('/slots')
        .query({ ...ids, date: '2033-05-09' })
        .expect(200)
    ).body;
    await a
      .post('/appointments')
      .send({ ...ids, customerId, startAt: slot.startAt })
      .expect(201);
  });

  it('is empty when the staff member does not offer the service or is inactive', async () => {
    const other = (await a.post('/services').send({ name: 'Nail', durationMin: 30, price: 0 }))
      .body;
    expect(await times({ ...ids, serviceId: other.id, date: MONDAY })).toEqual([]);

    const temp = (
      await a.post('/staff').send({
        name: 'Off',
        workingHours: { mon: [{ start: '09:00', end: '10:00' }] },
        serviceIds: [ids.serviceId],
      })
    ).body;
    await a.patch(`/staff/${temp.id}`).send({ isActive: false }).expect(200);
    expect(await times({ ...ids, staffId: temp.id, date: MONDAY })).toEqual([]);
  });

  it('validates the query and isolates salons', async () => {
    await a
      .get('/slots')
      .query({ ...ids, date: '02/05/2033' })
      .expect(400);
    await a
      .get('/slots')
      .query({ ...ids, staffId: randomUUID(), date: MONDAY })
      .expect(404);
    await b
      .get('/slots')
      .query({ ...ids, date: MONDAY })
      .expect(404);
  });
});
