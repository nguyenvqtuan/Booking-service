import { ErrorCode } from '@booking/shared';
import { OwnerFactory, type TestOwner } from './utils/owners.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

describe('appointments (e2e)', () => {
  let t: TestApp;
  let owners: OwnerFactory;
  let a: TestOwner;
  let b: TestOwner;
  let ids: { customerId: string; staffId: string; serviceId: string };
  let otherStaffId: string;
  let longServiceId: string;
  /** Each test books on its own day to stay independent. */
  let day = 0;
  const slot = (hhmm: string, d = day) =>
    `2031-01-${String(1 + d).padStart(2, '0')}T${hhmm}:00+07:00`;

  beforeAll(async () => {
    t = await createTestApp();
    owners = new OwnerFactory(t);
    [a, b] = await Promise.all([owners.create(), owners.create()]);
    const cut = (await a.post('/services').send({ name: 'Cắt tóc', durationMin: 30, price: 0 }))
      .body;
    const color = (await a.post('/services').send({ name: 'Nhuộm', durationMin: 90, price: 0 }))
      .body;
    longServiceId = color.id;
    const staff = (
      await a.post('/staff').send({ name: 'An', workingHours: {}, serviceIds: [cut.id, color.id] })
    ).body;
    otherStaffId = (
      await a.post('/staff').send({ name: 'Bình', workingHours: {}, serviceIds: [cut.id] })
    ).body.id;
    const customer = (await a.post('/customers').send({ name: 'Chi', phone: '0901234567' })).body;
    ids = { customerId: customer.id, staffId: staff.id, serviceId: cut.id };
  });

  beforeEach(() => {
    day++;
  });

  afterAll(async () => {
    await owners.cleanup();
    await t.app.close();
  });

  const book = (startAt: string, extra: Record<string, unknown> = {}) =>
    a.post('/appointments').send({ ...ids, startAt, ...extra });

  it('creates an appointment with end_at = start + service duration', async () => {
    const res = await book(slot('15:00')).expect(201);
    expect(res.body).toMatchObject({
      // 15:00 in Vietnam (+07:00) is stored as 08:00 UTC.
      startAt: new Date(slot('15:00')).toISOString(),
      status: 'booked',
      source: 'admin',
      customerName: 'Chi',
      staffName: 'An',
      serviceName: 'Cắt tóc',
    });
    expect(res.body.startAt).toMatch(/T08:00:00\.000Z$/);
    expect(new Date(res.body.endAt).getTime() - new Date(res.body.startAt).getTime()).toBe(
      30 * 60_000,
    );
  });

  it('rejects an overlapping booking for the same staff member with 409', async () => {
    await book(slot('09:00')).expect(201);
    const res = await book(slot('09:15')).expect(409);
    expect(res.body.code).toBe(ErrorCode.AppointmentOverlap);
  });

  it('allows back-to-back bookings and the same time for another staff member', async () => {
    await book(slot('09:00')).expect(201);
    await book(slot('09:30')).expect(201);
    await book(slot('09:00'), { staffId: otherStaffId }).expect(201);
  });

  it('lets only one of two concurrent requests for the same slot succeed (BS-63)', async () => {
    const results = await Promise.all([
      book(slot('10:00')),
      book(slot('10:00')),
      book(slot('10:10')),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
  });

  it('frees the slot when an appointment is cancelled', async () => {
    const { body } = await book(slot('11:00')).expect(201);
    await a.post(`/appointments/${body.id}/status`).send({ status: 'cancelled' }).expect(200);
    await book(slot('11:00')).expect(201);
  });

  it('reschedules, recomputes end_at and refuses moving into an occupied slot', async () => {
    const { body: first } = await book(slot('13:00')).expect(201);
    const { body: second } = await book(slot('14:00')).expect(201);

    const moved = await a
      .patch(`/appointments/${first.id}`)
      .send({ startAt: slot('16:00') })
      .expect(200);
    expect(moved.body.startAt).toBe(new Date(slot('16:00')).toISOString());

    const longer = await a
      .patch(`/appointments/${first.id}`)
      .send({ serviceId: longServiceId })
      .expect(200);
    expect(new Date(longer.body.endAt).getTime() - new Date(longer.body.startAt).getTime()).toBe(
      90 * 60_000,
    );

    const clash = await a
      .patch(`/appointments/${second.id}`)
      .send({ startAt: slot('16:30') })
      .expect(409);
    expect(clash.body.code).toBe(ErrorCode.AppointmentOverlap);
  });

  it('follows the status state machine', async () => {
    const { body } = await book(slot('08:00')).expect(201);
    const confirmed = await a
      .post(`/appointments/${body.id}/status`)
      .send({ status: 'confirmed' })
      .expect(200);
    expect(confirmed.body.status).toBe('confirmed');
    await a.post(`/appointments/${body.id}/status`).send({ status: 'completed' }).expect(200);

    const res = await a
      .post(`/appointments/${body.id}/status`)
      .send({ status: 'cancelled' })
      .expect(409);
    expect(res.body.code).toBe(ErrorCode.AppointmentInvalidTransition);
    await a.post(`/appointments/${body.id}/status`).send({ status: 'booked' }).expect(400);

    const edit = await a.patch(`/appointments/${body.id}`).send({ note: 'x' }).expect(409);
    expect(edit.body.code).toBe(ErrorCode.AppointmentNotEditable);
  });

  describe('reference checks (implicit relations, BS-70)', () => {
    it("rejects another salon's customer/staff/service", async () => {
      const foreignCustomer = (await b.post('/customers').send({ name: 'B', phone: '0909999999' }))
        .body;
      const res = await book(slot('09:00'), { customerId: foreignCustomer.id }).expect(400);
      expect(res.body.fields.customerId).toBeDefined();
    });

    it('rejects a staff member who does not offer the service', async () => {
      const res = await book(slot('09:00'), {
        staffId: otherStaffId,
        serviceId: longServiceId,
      }).expect(400);
      expect(res.body.code).toBe(ErrorCode.StaffCannotPerformService);
    });

    it('rejects an inactive staff member', async () => {
      const temp = (
        await a.post('/staff').send({ name: 'Tạm', workingHours: {}, serviceIds: [ids.serviceId] })
      ).body;
      await a.patch(`/staff/${temp.id}`).send({ isActive: false }).expect(200);
      const res = await book(slot('09:00'), { staffId: temp.id }).expect(400);
      expect(res.body.code).toBe(ErrorCode.ReferenceInactive);
    });

    it('rejects a start time without timezone offset', async () => {
      await book('2031-02-01T09:00:00').expect(400);
    });
  });

  it('lists appointments overlapping a range, optionally by staff', async () => {
    await book(slot('09:00')).expect(201);
    await book(slot('10:00'), { staffId: otherStaffId }).expect(201);
    await book(slot('09:00', day + 1)).expect(201); // next day, outside the range
    day++;

    const from = new Date(slot('00:00', day - 1)).toISOString();
    const to = new Date(slot('00:00', day)).toISOString();
    const all = await a.get('/appointments').query({ from, to }).expect(200);
    expect(all.body.map((x: { staffName: string }) => x.staffName)).toEqual(['An', 'Bình']);
    const onlyBinh = await a
      .get('/appointments')
      .query({ from, to, staffId: otherStaffId })
      .expect(200);
    expect(onlyBinh.body).toHaveLength(1);
    await a.get('/appointments').query({ from: to, to: from }).expect(400);
  });

  it('isolates salons', async () => {
    const { body } = await book(slot('09:00')).expect(201);
    await b.get(`/appointments/${body.id}`).expect(404);
    await b.patch(`/appointments/${body.id}`).send({ note: 'x' }).expect(404);
    await b.post(`/appointments/${body.id}/status`).send({ status: 'cancelled' }).expect(404);
    const list = await b
      .get('/appointments')
      .query({ from: '2031-01-01T00:00:00Z', to: '2031-12-31T00:00:00Z' })
      .expect(200);
    expect(list.body).toEqual([]);
  });
});
