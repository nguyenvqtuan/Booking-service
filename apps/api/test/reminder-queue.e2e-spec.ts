import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { localToUtc, ReminderJobStatus } from '@booking/shared';
import { In, Not } from 'typeorm';
import { MessageLog, ReminderJob } from '../src/database/entities/index.js';
import { type FakeProvider } from '../src/messaging/fake.provider.js';
import { SendOutcome, SMS_PROVIDER, ZNS_PROVIDER } from '../src/messaging/message-provider.js';
import type { ReminderQueue } from '../src/queue/queue.module.js';
import { REMINDER_QUEUE } from '../src/queue/queue.constants.js';
import { ReminderDispatcher } from '../src/reminders/reminder-dispatcher.service.js';
import { ReminderSender } from '../src/reminders/reminder-sender.service.js';
import { ReminderWorker } from '../src/worker/reminder.worker.js';
import { WorkerModule } from '../src/worker/worker.module.js';
import { OwnerFactory, type TestOwner } from './utils/owners.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

const VN = 'Asia/Ho_Chi_Minh';

describe('reminder queue: dispatcher + worker (e2e)', () => {
  let t: TestApp;
  let owners: OwnerFactory;
  let a: TestOwner;
  let queue: ReminderQueue;
  let dispatcher: ReminderDispatcher;
  let worker: INestApplicationContext;
  let sender: ReminderSender;
  let zns: FakeProvider;
  let sms: FakeProvider;
  let ids: { customerId: string; staffId: string; serviceId: string };
  let day = 0;

  const jobs = () => t.dataSource.getRepository(ReminderJob);

  /** Books an appointment and makes all its reminders due now. Returns the reminder ids. */
  async function dueReminders(): Promise<string[]> {
    day++;
    const startAt = localToUtc(
      `2033-04-${String(day).padStart(2, '0')}`,
      '15:00',
      VN,
    ).toISOString();
    const { body } = await a
      .post('/appointments')
      .send({ ...ids, startAt })
      .expect(201);
    const list = await jobs().findBy({ appointmentId: body.id });
    await jobs().update({ id: In(list.map((j) => j.id)) }, { sendAt: new Date(Date.now() - 1000) });
    return list.map((j) => j.id);
  }

  beforeAll(async () => {
    t = await createTestApp();
    owners = new OwnerFactory(t);
    a = await owners.create();
    queue = t.app.get(REMINDER_QUEUE);
    dispatcher = t.app.get(ReminderDispatcher);
    await queue.obliterate({ force: true });
    // Leftover due jobs from other suites must not leak into the counts below.
    await jobs().update(
      { status: ReminderJobStatus.Pending },
      { status: ReminderJobStatus.Cancelled },
    );

    worker = await NestFactory.createApplicationContext(WorkerModule, { logger: false });
    // The BullMQ consumer is started only in the smoke test below.
    await worker.get(ReminderWorker).onApplicationShutdown();
    sender = worker.get(ReminderSender);
    zns = worker.get(ZNS_PROVIDER);
    sms = worker.get(SMS_PROVIDER);

    const svc = (await a.post('/services').send({ name: 'Cắt tóc', durationMin: 30, price: 0 }))
      .body;
    const staff = (
      await a.post('/staff').send({ name: 'An', workingHours: {}, serviceIds: [svc.id] })
    ).body;
    const cust = (await a.post('/customers').send({ name: 'Lê Chi', phone: '0901234567' })).body;
    ids = { customerId: cust.id, staffId: staff.id, serviceId: svc.id };
  });

  beforeEach(() => {
    zns.reset();
    sms.reset();
  });

  afterAll(async () => {
    await queue?.obliterate({ force: true });
    await worker?.close();
    await owners.cleanup();
    await t.app.close();
  });

  it('queues only due jobs, marks them queued and uses the reminder id as BullMQ job id', async () => {
    const due = await dueReminders();
    const enqueued = await dispatcher.dispatchDue();
    expect(enqueued).toBe(due.length);
    for (const id of due) {
      expect((await jobs().findOneByOrFail({ id })).status).toBe(ReminderJobStatus.Queued);
      expect(await queue.getJob(id)).toBeDefined();
    }
    expect(await dispatcher.dispatchDue()).toBe(0);
  });

  it('never enqueues a job twice when two dispatchers run concurrently (BS-61)', async () => {
    const due = [...(await dueReminders()), ...(await dueReminders()), ...(await dueReminders())];
    const counts = await Promise.all([dispatcher.dispatchDue(), dispatcher.dispatchDue()]);
    expect(counts[0] + counts[1]).toBe(due.length);
    const queued = await jobs().findBy({ id: In(due), status: ReminderJobStatus.Queued });
    expect(queued).toHaveLength(due.length);
  });

  it('sends a queued reminder, logs it and formats the time in the salon timezone', async () => {
    const [id] = await dueReminders();
    await dispatcher.dispatchDue();

    expect(await sender.process(id)).toBe('sent');
    const job = await jobs().findOneByOrFail({ id });
    expect(job).toMatchObject({ status: ReminderJobStatus.Sent, attemptCount: 1 });
    expect(job.sentAt).toBeInstanceOf(Date);
    expect(zns.sent.at(-1)).toMatchObject({
      to: '+84901234567',
      locale: 'vi',
      params: { customerName: 'Lê Chi', serviceName: 'Cắt tóc', time: '15:00' },
    });
    const logs = await t.dataSource.getRepository(MessageLog).findBy({ reminderJobId: id });
    expect(logs).toEqual([
      expect.objectContaining({
        channel: 'zns',
        provider: 'fake',
        status: 'success',
        providerMsgId: expect.any(String),
      }),
    ]);
  });

  it('sends exactly one message when two workers process the same job (BS-61)', async () => {
    const [id] = await dueReminders();
    await dispatcher.dispatchDue();
    const results = await Promise.all([sender.process(id), sender.process(id), sender.process(id)]);
    expect(results.filter((r) => r === 'sent')).toHaveLength(1);
    expect(results.filter((r) => r === 'skipped')).toHaveLength(2);
    expect(zns.sent).toHaveLength(1);
  });

  it('does not send for an appointment cancelled after its reminder was queued (BS-68)', async () => {
    const [id] = await dueReminders();
    await dispatcher.dispatchDue();
    const { appointmentId } = await jobs().findOneByOrFail({ id });
    // Simulate a cancellation that raced with the dispatcher: the job stays queued.
    await t.dataSource.query(`UPDATE appointments SET status = 'cancelled' WHERE id = $1`, [
      appointmentId,
    ]);

    expect(await sender.process(id)).toBe('cancelled');
    expect(zns.sent).toHaveLength(0);
  });

  describe('ZNS -> SMS fallback (BS-31, BS-65)', () => {
    const PHONE = '+84901234567';
    const logsOf = async (id: string) =>
      (
        await t.dataSource
          .getRepository(MessageLog)
          .find({ where: { reminderJobId: id }, order: { createdAt: 'ASC' } })
      ).map((l) => `${l.channel}:${l.status}`);
    const queuedReminder = async () => {
      const [id] = await dueReminders();
      await dispatcher.dispatchDue();
      return id;
    };

    afterEach(async () => {
      await a
        .put('/reminder-settings')
        .send({ offsets: [1440, 120], fallbackEnabled: true })
        .expect(200);
    });

    it('sends an SMS when the customer cannot receive ZNS, and counts the job once', async () => {
      const id = await queuedReminder();
      zns.respondTo(PHONE, SendOutcome.RecipientUnreachable);

      expect(await sender.process(id)).toBe('sent');
      expect(sms.sent).toHaveLength(1);
      expect(zns.sent).toHaveLength(0);
      expect(await logsOf(id)).toEqual(['zns:recipient_unreachable', 'sms:success']);
      expect((await jobs().findOneByOrFail({ id })).status).toBe(ReminderJobStatus.Sent);
    });

    it('does not send SMS when the salon disabled the fallback', async () => {
      await a
        .put('/reminder-settings')
        .send({ offsets: [1440, 120], fallbackEnabled: false })
        .expect(200);
      const id = await queuedReminder();
      zns.respondTo(PHONE, SendOutcome.RecipientUnreachable);

      expect(await sender.process(id)).toBe('failed');
      expect(sms.sent).toHaveLength(0);
      expect(await logsOf(id)).toEqual(['zns:recipient_unreachable']);
      expect((await jobs().findOneByOrFail({ id })).lastError).toContain('fallback disabled');
    });

    it('reports a failure when SMS fails too', async () => {
      const id = await queuedReminder();
      zns.respondTo(PHONE, SendOutcome.RecipientUnreachable);
      sms.respondTo(PHONE, SendOutcome.Permanent);

      expect(await sender.process(id)).toBe('failed');
      expect(await logsOf(id)).toEqual(['zns:recipient_unreachable', 'sms:permanent']);
    });

    it('does not fall back on other ZNS errors (e.g. template/config problems)', async () => {
      const id = await queuedReminder();
      zns.respondTo(PHONE, SendOutcome.Permanent);

      expect(await sender.process(id)).toBe('failed');
      expect(sms.sent).toHaveLength(0);
      expect(await logsOf(id)).toEqual(['zns:permanent']);
    });
  });

  describe('idempotency (BS-33, BS-61)', () => {
    it('ignores a second enqueue with the same job id while the first one is waiting', async () => {
      await queue.obliterate({ force: true });
      const opts = { jobId: 'dup-job-id' };
      await queue.add('send-reminder', { reminderJobId: 'dup-job-id' }, opts);
      await queue.add('send-reminder', { reminderJobId: 'dup-job-id' }, opts);
      expect((await queue.getJobCounts()).waiting).toBe(1);
      await queue.obliterate({ force: true });
    });

    it('does not send again when a sent job is processed a second time', async () => {
      const [id] = await dueReminders();
      await dispatcher.dispatchDue();
      expect(await sender.process(id)).toBe('sent');
      expect(await sender.process(id)).toBe('skipped');
      expect(zns.sent).toHaveLength(1);
      const logs = await t.dataSource.getRepository(MessageLog).countBy({ reminderJobId: id });
      expect(logs).toBe(1);
    });

    it('sends one message per job with several real BullMQ workers', async () => {
      await queue.obliterate({ force: true });
      const due: string[] = [];
      for (let i = 0; i < 5; i++) due.push(...(await dueReminders()));
      const consumers = await Promise.all(
        [1, 2, 3].map(() => NestFactory.createApplicationContext(WorkerModule, { logger: false })),
      );
      const fakes = consumers.map((c) => c.get<FakeProvider>(ZNS_PROVIDER));
      try {
        await dispatcher.dispatchDue();
        await vi.waitFor(
          async () =>
            expect(await jobs().countBy({ id: In(due), status: ReminderJobStatus.Sent })).toBe(
              due.length,
            ),
          { timeout: 15_000, interval: 100 },
        );
        expect(fakes.reduce((n, f) => n + f.sent.length, 0)).toBe(due.length);
        const logs = await t.dataSource
          .getRepository(MessageLog)
          .countBy({ reminderJobId: In(due) });
        expect(logs).toBe(due.length);
      } finally {
        await Promise.all(consumers.map((c) => c.close()));
      }
    }, 30_000);

    it('fails a job left in "sending" by a dead worker instead of sending it again', async () => {
      const [id] = await dueReminders();
      await dispatcher.dispatchDue();
      await t.dataSource.query(
        `UPDATE reminder_jobs SET status = 'sending', updated_at = now() - interval '31 minutes' WHERE id = $1`,
        [id],
      );
      expect(await sender.process(id)).toBe('skipped');
      await dispatcher.failStuckSending();
      const job = await jobs().findOneByOrFail({ id });
      expect(job.status).toBe(ReminderJobStatus.Failed);
      expect(job.lastError).toContain('delivery unknown');
      expect(zns.sent).toHaveLength(0);
    });
  });

  describe('retry with backoff (BS-32)', () => {
    const PHONE = '+84901234567';
    const logsOf = async (id: string) =>
      (
        await t.dataSource
          .getRepository(MessageLog)
          .find({ where: { reminderJobId: id }, order: { createdAt: 'ASC' } })
      ).map((l) => l.status);

    it('marks a transient failure as retrying while attempts remain, then it can be claimed again', async () => {
      const [id] = await dueReminders();
      await dispatcher.dispatchDue();
      zns.respondTo(PHONE, SendOutcome.Transient);

      expect(await sender.process(id, { isLastAttempt: false })).toBe('retry');
      const job = await jobs().findOneByOrFail({ id });
      expect(job).toMatchObject({ status: ReminderJobStatus.Retrying, attemptCount: 1 });
      expect(job.lastError).toContain('transient');

      expect(await sender.process(id, { isLastAttempt: false })).toBe('sent');
      expect((await jobs().findOneByOrFail({ id })).attemptCount).toBe(2);
      expect(await logsOf(id)).toEqual(['transient', 'success']);
    });

    it('never retries a permanent failure (e.g. invalid phone)', async () => {
      const [id] = await dueReminders();
      await dispatcher.dispatchDue();
      zns.respondTo(PHONE, SendOutcome.Permanent);
      expect(await sender.process(id, { isLastAttempt: false })).toBe('failed');
      expect((await jobs().findOneByOrFail({ id })).status).toBe(ReminderJobStatus.Failed);
    });

    async function runWorkerUntil(ids: string[], status: ReminderJobStatus) {
      const consumer = worker.get(ReminderWorker);
      consumer.onModuleInit();
      try {
        await dispatcher.dispatchDue();
        await vi.waitFor(
          async () => expect(await jobs().findBy({ id: In(ids), status })).toHaveLength(ids.length),
          { timeout: 15_000, interval: 100 },
        );
      } finally {
        await consumer.onApplicationShutdown();
      }
    }

    it('the queue retries transient failures with backoff until the reminder is sent', async () => {
      await queue.obliterate({ force: true });
      const [id] = await dueReminders();
      await jobs().update(
        { appointmentId: (await jobs().findOneByOrFail({ id })).appointmentId, id: Not(id) },
        { status: ReminderJobStatus.Cancelled },
      );
      zns.respondTo(PHONE, SendOutcome.Transient, SendOutcome.Transient);

      await runWorkerUntil([id], ReminderJobStatus.Sent);
      expect((await jobs().findOneByOrFail({ id })).attemptCount).toBe(3);
      expect(await logsOf(id)).toEqual(['transient', 'transient', 'success']);
    }, 20_000);

    it('gives up after 1 + 3 retries and marks the job failed', async () => {
      await queue.obliterate({ force: true });
      const [id] = await dueReminders();
      await jobs().update(
        { appointmentId: (await jobs().findOneByOrFail({ id })).appointmentId, id: Not(id) },
        { status: ReminderJobStatus.Cancelled },
      );
      zns.respondTo(PHONE, ...Array<SendOutcome>(10).fill(SendOutcome.Transient));

      await runWorkerUntil([id], ReminderJobStatus.Failed);
      expect((await jobs().findOneByOrFail({ id })).attemptCount).toBe(4);
      expect(await logsOf(id)).toEqual(['transient', 'transient', 'transient', 'transient']);
    }, 20_000);

    it('puts a "retrying" job that lost its queue entry back to pending', async () => {
      const [id] = await dueReminders();
      await jobs().update({ id }, { status: ReminderJobStatus.Retrying });
      await t.dataSource.query(
        `UPDATE reminder_jobs SET updated_at = now() - interval '31 minutes' WHERE id = $1`,
        [id],
      );
      await dispatcher.requeueStale();
      expect((await jobs().findOneByOrFail({ id })).status).toBe(ReminderJobStatus.Pending);
    });
  });

  it('puts jobs stuck in "queued" back to pending', async () => {
    const [id] = await dueReminders();
    await dispatcher.dispatchDue();
    await t.dataSource.query(
      `UPDATE reminder_jobs SET updated_at = now() - interval '11 minutes' WHERE id = $1`,
      [id],
    );
    expect(await dispatcher.requeueStale()).toBeGreaterThanOrEqual(1);
    expect((await jobs().findOneByOrFail({ id })).status).toBe(ReminderJobStatus.Pending);
  });

  it('end to end: the BullMQ worker consumes the queue and sends the reminder', async () => {
    await queue.obliterate({ force: true });
    const due = await dueReminders();
    const consumer = worker.get(ReminderWorker);
    consumer.onModuleInit();
    try {
      await dispatcher.dispatchDue();
      await vi.waitFor(
        async () => {
          const sent = await jobs().findBy({ id: In(due), status: ReminderJobStatus.Sent });
          expect(sent).toHaveLength(due.length);
        },
        { timeout: 10_000, interval: 200 },
      );
    } finally {
      await consumer.onApplicationShutdown();
    }
  });
});
