import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { ErrorCode, localToUtc, ReminderJobStatus } from '@booking/shared';
import request from 'supertest';
import { ActionTokenService } from '../src/appointment-actions/action-token.service.js';
import {
  Appointment,
  AppointmentActionToken,
  ReminderJob,
} from '../src/database/entities/index.js';
import { findOrphans } from '../src/database/implicit-relations.js';
import type { FakeProvider } from '../src/messaging/fake.provider.js';
import { ZNS_PROVIDER } from '../src/messaging/message-provider.js';
import { ReminderSender } from '../src/reminders/reminder-sender.service.js';
import { ReminderWorker } from '../src/worker/reminder.worker.js';
import { WorkerModule } from '../src/worker/worker.module.js';
import { OwnerFactory, type TestOwner } from './utils/owners.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

const VN = 'Asia/Ho_Chi_Minh';

describe('appointment actions by link (e2e)', () => {
  let t: TestApp;
  let owners: OwnerFactory;
  let a: TestOwner;
  let ids: { customerId: string; staffId: string; serviceId: string };
  let day = 0;

  const http = () => request(t.app.getHttpServer());
  const appointments = () => t.dataSource.getRepository(Appointment);
  const nextDate = () => {
    day++;
    return `2035-07-${String(day).padStart(2, '0')}`;
  };
  const at = (date: string, time: string) => localToUtc(date, time, VN).toISOString();

  /** Books an appointment and issues a link token for it. */
  async function linkFor(date = nextDate(), time = '09:00') {
    const { body } = await a
      .post('/appointments')
      .send({ ...ids, startAt: at(date, time) })
      .expect(201);
    const row = await appointments().findOneByOrFail({ id: body.id });
    const token = await t.app.get(ActionTokenService).issue(row);
    return { token, id: body.id as string, date };
  }

  beforeAll(async () => {
    t = await createTestApp();
    owners = new OwnerFactory(t);
    a = await owners.create();
    const svc = (await a.post('/services').send({ name: 'Cắt tóc', durationMin: 30, price: 0 }))
      .body;
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
    const cust = (await a.post('/customers').send({ name: 'Chi', phone: '0901234567' })).body;
    ids = { customerId: cust.id, staffId: staff.id, serviceId: svc.id };
  });

  afterAll(async () => {
    await owners.cleanup();
    await t.app.close();
  });

  it('shows the appointment without login and without customer data, and does not consume the token', async () => {
    const { token } = await linkFor();
    const res = await http().get(`/appointment-actions/${token}`).expect(200);
    expect(res.body).toMatchObject({
      salonName: 'Test Salon',
      serviceName: 'Cắt tóc',
      staffName: 'An',
      status: 'booked',
      timezone: VN,
    });
    expect(JSON.stringify(res.body)).not.toContain('84901234567');
    await http().get(`/appointment-actions/${token}`).expect(200);
  });

  it('confirms the appointment', async () => {
    const { token, id } = await linkFor();
    const res = await http().post(`/appointment-actions/${token}/confirm`).expect(200);
    expect(res.body.status).toBe('confirmed');
    expect((await appointments().findOneByOrFail({ id })).status).toBe('confirmed');
  });

  it('cancels: frees the slot and cancels remaining reminders', async () => {
    const { token, id, date } = await linkFor();
    await http().post(`/appointment-actions/${token}/cancel`).expect(200);

    const jobs = await t.dataSource.getRepository(ReminderJob).findBy({ appointmentId: id });
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs.every((j) => j.status === ReminderJobStatus.Cancelled)).toBe(true);
    await a
      .post('/appointments')
      .send({ ...ids, startAt: at(date, '09:00') })
      .expect(201);
  });

  it('reschedules to a free slot and moves the reminders', async () => {
    const { token, id, date } = await linkFor();
    const slots = await http()
      .get(`/appointment-actions/${token}/slots`)
      .query({ date })
      .expect(200);
    // Its own time stays selectable: an appointment does not block itself.
    expect(slots.body.map((s: { time: string }) => s.time)).toContain('09:00');

    const res = await http()
      .post(`/appointment-actions/${token}/reschedule`)
      .send({ startAt: at(date, '10:30') })
      .expect(200);
    expect(res.body.startAt).toBe(at(date, '10:30'));
    const job = await t.dataSource
      .getRepository(ReminderJob)
      .findOneByOrFail({ appointmentId: id, offsetMinutes: 120 });
    expect(job.sendAt.toISOString()).toBe(at(date, '08:30'));
  });

  it('refuses to reschedule outside the offered slots and keeps the link usable', async () => {
    const { token, id, date } = await linkFor();
    const res = await http()
      .post(`/appointment-actions/${token}/reschedule`)
      .send({ startAt: at(date, '20:00') })
      .expect(409);
    expect(res.body.code).toBe(ErrorCode.SlotUnavailable);
    expect((await appointments().findOneByOrFail({ id })).startAt.toISOString()).toBe(
      at(date, '09:00'),
    );
    await http().post(`/appointment-actions/${token}/confirm`).expect(200);
  });

  it('refuses to reschedule onto another booking', async () => {
    const { token, date } = await linkFor();
    await a
      .post('/appointments')
      .send({ ...ids, startAt: at(date, '10:00') })
      .expect(201);
    await http()
      .post(`/appointment-actions/${token}/reschedule`)
      .send({ startAt: at(date, '10:00') })
      .expect(409);
  });

  describe('invalid links change nothing', () => {
    it('rejects a used token', async () => {
      const { token, id } = await linkFor();
      await http().post(`/appointment-actions/${token}/confirm`).expect(200);
      const res = await http().post(`/appointment-actions/${token}/cancel`).expect(410);
      expect(res.body.code).toBe(ErrorCode.ActionTokenInvalid);
      await http().get(`/appointment-actions/${token}`).expect(410);
      expect((await appointments().findOneByOrFail({ id })).status).toBe('confirmed');
    });

    it('rejects an expired token', async () => {
      const { token, id } = await linkFor();
      await t.dataSource
        .getRepository(AppointmentActionToken)
        .update({ appointmentId: id }, { expiresAt: new Date(Date.now() - 1000) });
      await http().post(`/appointment-actions/${token}/cancel`).expect(410);
      expect((await appointments().findOneByOrFail({ id })).status).toBe('booked');
    });

    it('rejects an unknown token', async () => {
      await http().post(`/appointment-actions/${randomUUID()}/confirm`).expect(410);
      await http().get(`/appointment-actions/${randomUUID()}`).expect(410);
    });

    it('stores only a hash of the token', async () => {
      const { token, id } = await linkFor();
      const row = await t.dataSource
        .getRepository(AppointmentActionToken)
        .findOneByOrFail({ appointmentId: id });
      expect(row.tokenHash).not.toContain(token);
      expect(row.tokenHash).toHaveLength(64);
    });

    it('lets only one of two concurrent uses of a link succeed', async () => {
      const { token, id } = await linkFor();
      const results = await Promise.all([
        http().post(`/appointment-actions/${token}/cancel`),
        http().post(`/appointment-actions/${token}/confirm`),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 410]);
      const winner = results.find((r) => r.status === 200)!.body.status;
      expect((await appointments().findOneByOrFail({ id })).status).toBe(winner);
    });
  });

  it('puts a working link in the reminder message', async () => {
    const { id } = await linkFor();
    const worker = await NestFactory.createApplicationContext(WorkerModule, { logger: false });
    try {
      await worker.get(ReminderWorker).onApplicationShutdown();
      const jobs = t.dataSource.getRepository(ReminderJob);
      await jobs.update(
        { status: ReminderJobStatus.Pending },
        { status: ReminderJobStatus.Cancelled },
      );
      const job = await jobs.findOneByOrFail({ appointmentId: id, offsetMinutes: 120 });
      await jobs.update({ id: job.id }, { status: ReminderJobStatus.Queued });

      expect(await worker.get(ReminderSender).process(job.id)).toBe('sent');
      const url = worker.get<FakeProvider>(ZNS_PROVIDER).sent.at(-1)!.params.actionUrl!;
      expect(url).toMatch(/\/appointment\/[\w-]{43}$/);
      await http()
        .get(`/appointment-actions/${url.split('/').pop()}`)
        .expect(200);
    } finally {
      await worker.close();
    }
  });

  it('removes tokens when the salon is deleted', async () => {
    const owner = await owners.create();
    const svc = (await owner.post('/services').send({ name: 'S', durationMin: 30, price: 0 })).body;
    const st = (
      await owner.post('/staff').send({ name: 'St', workingHours: {}, serviceIds: [svc.id] })
    ).body;
    const cu = (await owner.post('/customers').send({ name: 'C', phone: '0955000111' })).body;
    const { body } = await owner
      .post('/appointments')
      .send({
        customerId: cu.id,
        staffId: st.id,
        serviceId: svc.id,
        startAt: at('2035-08-01', '09:00'),
      })
      .expect(201);
    await t.app
      .get(ActionTokenService)
      .issue(await appointments().findOneByOrFail({ id: body.id }));
    await owners.cleanup();
    expect(await findOrphans(t.dataSource)).toEqual([]);
  });
});
