import { localToUtc, ReminderJobStatus, utcToLocal } from '@booking/shared';
import { ReminderJob } from '../src/database/entities/index.js';
import { OwnerFactory, type TestOwner } from './utils/owners.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

const VN = 'Asia/Ho_Chi_Minh';

describe('reminder jobs (e2e)', () => {
  let t: TestApp;
  let owners: OwnerFactory;
  let a: TestOwner;
  let ids: { customerId: string; staffId: string; serviceId: string };
  let day = 0;
  /** A salon-local date far enough in the future, one per test. */
  const futureDate = () => {
    day++;
    return `2032-03-${String(day).padStart(2, '0')}`;
  };

  beforeAll(async () => {
    t = await createTestApp();
    owners = new OwnerFactory(t);
    a = await owners.create();
    const svc = (await a.post('/services').send({ name: 'Cut', durationMin: 30, price: 0 })).body;
    const staff = (
      await a.post('/staff').send({ name: 'An', workingHours: {}, serviceIds: [svc.id] })
    ).body;
    const cust = (await a.post('/customers').send({ name: 'Chi', phone: '0901234567' })).body;
    ids = { customerId: cust.id, staffId: staff.id, serviceId: svc.id };
  });

  afterAll(async () => {
    await owners.cleanup();
    await t.app.close();
  });

  const book = async (startAt: string) =>
    (
      await a
        .post('/appointments')
        .send({ ...ids, startAt })
        .expect(201)
    ).body;
  const reminders = async (id: string) =>
    (await a.get(`/appointments/${id}`).expect(200)).body.reminders;
  const local = (iso: string) => utcToLocal(new Date(iso), VN);

  it('creates one pending job per default offset (24h and 2h) with exact send_at', async () => {
    const date = futureDate();
    const appt = await book(localToUtc(date, '15:00', VN).toISOString());
    const jobs = await reminders(appt.id);
    expect(jobs.map((j: { offsetMinutes: number }) => j.offsetMinutes)).toEqual([1440, 120]);
    expect(jobs.every((j: { status: string }) => j.status === 'pending')).toBe(true);
    expect(local(jobs[1].sendAt)).toMatchObject({ date, time: '13:00' }); // 2h before
    expect(local(jobs[0].sendAt).time).toBe('15:00'); // 24h before, previous day
  });

  it('does not schedule reminders whose time has already passed', async () => {
    // Starts in ~3 hours: the 24h reminder is in the past, the 2h one is not.
    const soon = new Date(Date.now() + 3 * 60 * 60 * 1000);
    soon.setUTCSeconds(0, 0);
    const appt = await book(soon.toISOString());
    const jobs = await reminders(appt.id);
    expect(jobs.map((j: { offsetMinutes: number }) => j.offsetMinutes)).toEqual([120]);
  });

  it('recomputes send_at when the appointment is rescheduled', async () => {
    const date = futureDate();
    const appt = await book(localToUtc(date, '15:00', VN).toISOString());
    await a
      .patch(`/appointments/${appt.id}`)
      .send({ startAt: localToUtc(date, '18:30', VN).toISOString() })
      .expect(200);
    const jobs = await reminders(appt.id);
    expect(jobs.map((j: { sendAt: string }) => local(j.sendAt).time)).toEqual(['18:30', '16:30']);
    expect(jobs).toHaveLength(2);
  });

  it('cancels pending reminders when the appointment is cancelled (BS-68)', async () => {
    const appt = await book(localToUtc(futureDate(), '10:00', VN).toISOString());
    await a.post(`/appointments/${appt.id}/status`).send({ status: 'cancelled' }).expect(200);
    const jobs = await reminders(appt.id);
    expect(jobs.map((j: { status: string }) => j.status)).toEqual(['cancelled', 'cancelled']);
  });

  it('cancels reminders when the appointment is completed early', async () => {
    const appt = await book(localToUtc(futureDate(), '10:00', VN).toISOString());
    await a.post(`/appointments/${appt.id}/status`).send({ status: 'completed' }).expect(200);
    expect(
      (await reminders(appt.id)).every((j: { status: string }) => j.status === 'cancelled'),
    ).toBe(true);
  });

  it('keeps reminders when the appointment is confirmed', async () => {
    const appt = await book(localToUtc(futureDate(), '10:00', VN).toISOString());
    await a.post(`/appointments/${appt.id}/status`).send({ status: 'confirmed' }).expect(200);
    expect(
      (await reminders(appt.id)).every((j: { status: string }) => j.status === 'pending'),
    ).toBe(true);
  });

  it('keeps a sent reminder on unrelated edits but re-arms it after a reschedule', async () => {
    const date = futureDate();
    const appt = await book(localToUtc(date, '15:00', VN).toISOString());
    const [dayBefore] = await reminders(appt.id);
    await t.dataSource
      .getRepository(ReminderJob)
      .update({ id: dayBefore.id }, { status: ReminderJobStatus.Sent, sentAt: new Date() });

    await a.patch(`/appointments/${appt.id}`).send({ note: 'VIP' }).expect(200);
    expect((await reminders(appt.id))[0].status).toBe('sent');

    await a
      .patch(`/appointments/${appt.id}`)
      .send({ startAt: localToUtc(date, '17:00', VN).toISOString() })
      .expect(200);
    const [rearmed] = await reminders(appt.id);
    expect(rearmed).toMatchObject({ status: 'pending', attemptCount: 0 });
    expect(local(rearmed.sendAt).time).toBe('17:00');
  });

  describe('salon reminder settings', () => {
    it('returns the defaults, validates and saves new offsets', async () => {
      const owner = await owners.create();
      const defaults = await owner.get('/reminder-settings').expect(200);
      expect(defaults.body).toEqual({ offsets: [1440, 120], fallbackEnabled: true });

      await owner
        .put('/reminder-settings')
        .send({ offsets: [1], fallbackEnabled: true })
        .expect(400);
      const saved = await owner
        .put('/reminder-settings')
        .send({ offsets: [60, 2880, 60], fallbackEnabled: false })
        .expect(200);
      expect(saved.body).toEqual({ offsets: [2880, 60], fallbackEnabled: false });
    });

    it('uses the salon offsets for new appointments; an empty list means no reminders', async () => {
      await a
        .put('/reminder-settings')
        .send({ offsets: [180], fallbackEnabled: true })
        .expect(200);
      const date = futureDate();
      const appt = await book(localToUtc(date, '15:00', VN).toISOString());
      const jobs = await reminders(appt.id);
      expect(jobs.map((j: { sendAt: string }) => local(j.sendAt).time)).toEqual(['12:00']);

      await a.put('/reminder-settings').send({ offsets: [], fallbackEnabled: true }).expect(200);
      const none = await book(localToUtc(futureDate(), '15:00', VN).toISOString());
      expect(await reminders(none.id)).toEqual([]);

      // Changing settings and then editing an old appointment drops reminders it no longer wants.
      await a.patch(`/appointments/${appt.id}`).send({ note: 'edited' }).expect(200);
      expect((await reminders(appt.id)).map((j: { status: string }) => j.status)).toEqual([
        'cancelled',
      ]);

      await a
        .put('/reminder-settings')
        .send({ offsets: [1440, 120], fallbackEnabled: true })
        .expect(200);
    });
  });
});
