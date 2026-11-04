import {
  AppointmentSource,
  AppointmentStatus,
  localToUtc,
  MessageChannel,
  MessageLogStatus,
} from '@booking/shared';
import { Appointment, MessageLog } from '../src/database/entities/index.js';
import { OwnerFactory, type TestOwner } from './utils/owners.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

const VN = 'Asia/Ho_Chi_Minh';

describe('GET /reports/summary (e2e)', () => {
  let t: TestApp;
  let owners: OwnerFactory;
  let a: TestOwner;
  let b: TestOwner;
  let ids: { customerId: string; staffId: string; serviceId: string };
  let hour = 0;

  /** Inserts raw rows: reports only read them, and past dates cannot be booked via the API. */
  async function appointment(date: string, status: AppointmentStatus, time?: string) {
    hour++;
    const startAt = localToUtc(date, time ?? `${String(8 + (hour % 12)).padStart(2, '0')}:00`, VN);
    await t.dataSource.getRepository(Appointment).insert({
      salonId: a.salonId,
      ...ids,
      startAt,
      endAt: new Date(startAt.getTime() + 60_000),
      status,
      source: AppointmentSource.Admin,
    });
  }

  beforeAll(async () => {
    t = await createTestApp();
    owners = new OwnerFactory(t);
    [a, b] = await Promise.all([owners.create(), owners.create()]);
    const svc = (await a.post('/services').send({ name: 'Cut', durationMin: 30, price: 0 })).body;
    const staff = (
      await a.post('/staff').send({ name: 'An', workingHours: {}, serviceIds: [svc.id] })
    ).body;
    const cust = (await a.post('/customers').send({ name: 'Chi', phone: '0901234567' })).body;
    ids = { customerId: cust.id, staffId: staff.id, serviceId: svc.id };

    await appointment('2030-01-10', AppointmentStatus.Completed);
    await appointment('2030-01-11', AppointmentStatus.Completed);
    await appointment('2030-01-12', AppointmentStatus.Completed);
    await appointment('2030-01-13', AppointmentStatus.NoShow);
    await appointment('2030-02-10', AppointmentStatus.Cancelled);
    await appointment('2030-02-11', AppointmentStatus.Booked);
    await appointment('2030-03-10', AppointmentStatus.Completed);

    const logs = t.dataSource.getRepository(MessageLog);
    const log = (createdAt: string, status: MessageLogStatus) =>
      logs.insert({
        salonId: a.salonId,
        channel: MessageChannel.Zns,
        provider: 'fake',
        toPhone: '+84901234567',
        status,
        createdAt: new Date(createdAt),
      });
    await log('2030-01-05T03:00:00Z', MessageLogStatus.Success);
    await log('2030-01-05T04:00:00Z', MessageLogStatus.Success);
    await log('2030-01-05T05:00:00Z', MessageLogStatus.Success);
    await log('2030-01-05T06:00:00Z', MessageLogStatus.Permanent);
  });

  afterAll(async () => {
    await owners.cleanup();
    await t.app.close();
  });

  it('matches the raw data for the whole range and groups by month', async () => {
    const res = await a
      .get('/reports/summary')
      .query({ from: '2030-01-01', to: '2030-03-31' })
      .expect(200);
    expect(res.body.totals).toEqual({
      appointments: 7,
      completed: 4,
      noShow: 1,
      cancelled: 1,
      noShowRate: 0.2,
      messages: 4,
      messagesSucceeded: 3,
      messageSuccessRate: 0.75,
    });
    expect(res.body.months.map((m: { month: string }) => m.month)).toEqual([
      '2030-01',
      '2030-02',
      '2030-03',
    ]);
    expect(res.body.months[0]).toMatchObject({
      completed: 3,
      noShow: 1,
      noShowRate: 0.25,
      messages: 4,
    });
    // Nothing finished in February: a rate would be meaningless.
    expect(res.body.months[1]).toMatchObject({
      appointments: 2,
      noShowRate: null,
      messageSuccessRate: null,
    });
  });

  it('honours the range', async () => {
    const res = await a
      .get('/reports/summary')
      .query({ from: '2030-02-01', to: '2030-02-28' })
      .expect(200);
    expect(res.body.totals.appointments).toBe(2);
    expect(res.body.months).toHaveLength(1);
  });

  it('uses salon-local days and months, not UTC', async () => {
    // 2030-05-01 01:00 in Vietnam is still 2030-04-30 in UTC.
    await appointment('2030-05-01', AppointmentStatus.Completed, '01:00');
    const may = await a
      .get('/reports/summary')
      .query({ from: '2030-05-01', to: '2030-05-31' })
      .expect(200);
    expect(may.body.months.map((m: { month: string }) => m.month)).toEqual(['2030-05']);
    expect(may.body.totals.completed).toBe(1);
    const april = await a
      .get('/reports/summary')
      .query({ from: '2030-04-01', to: '2030-04-30' })
      .expect(200);
    expect(april.body.totals.appointments).toBe(0);
  });

  it('returns an empty report for a salon without data', async () => {
    const res = await b
      .get('/reports/summary')
      .query({ from: '2030-01-01', to: '2030-12-31' })
      .expect(200);
    expect(res.body.months).toEqual([]);
    expect(res.body.totals).toMatchObject({
      appointments: 0,
      noShowRate: null,
      messageSuccessRate: null,
    });
  });

  it('validates the range', async () => {
    await a.get('/reports/summary').query({ from: '2030-02-01', to: '2030-01-01' }).expect(400);
    await a.get('/reports/summary').query({ from: 'x', to: '2030-01-01' }).expect(400);
  });
});
