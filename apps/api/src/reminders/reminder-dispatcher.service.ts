import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { ReminderJobStatus } from '@booking/shared';
import type { ReminderQueue } from '../queue/queue.module.js';
import { REMINDER_QUEUE } from '../queue/queue.constants.js';

const BATCH_SIZE = 500;
/** A job still "queued" after this long was probably lost (e.g. Redis down after the DB update). */
const STALE_QUEUED_MINUTES = 10;

/**
 * Moves due reminder jobs from the database to the queue (BS-27).
 * Safe with several API instances: rows are claimed with FOR UPDATE SKIP LOCKED and the
 * BullMQ job id equals the reminder id, so a job can never be enqueued twice (BS-33, BS-61).
 */
@Injectable()
export class ReminderDispatcher {
  private readonly logger = new Logger(ReminderDispatcher.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(REMINDER_QUEUE) private readonly queue: ReminderQueue,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'reminder-dispatch' })
  async tick(): Promise<void> {
    if (!this.config.get<boolean>('REMINDER_CRON_ENABLED')) return;
    try {
      await this.requeueStale();
      const count = await this.dispatchDue();
      if (count) this.logger.log(`Queued ${count} reminder(s)`);
    } catch (err) {
      this.logger.error(`Reminder dispatch failed: ${(err as Error).stack ?? err}`);
    }
  }

  /** Claims due pending jobs (send_at <= now) and enqueues them. Returns how many were queued. */
  async dispatchDue(now: Date = new Date()): Promise<number> {
    let total = 0;
    for (;;) {
      const [rows] = (await this.dataSource.query(
        `UPDATE reminder_jobs SET status = $1, updated_at = now()
         WHERE id IN (
           SELECT id FROM reminder_jobs
           WHERE status = $2 AND send_at <= $3
           ORDER BY send_at
           LIMIT $4
           FOR UPDATE SKIP LOCKED
         )
         RETURNING id`,
        [ReminderJobStatus.Queued, ReminderJobStatus.Pending, now, BATCH_SIZE],
      )) as [{ id: string }[], number];
      if (!rows.length) return total;

      await this.queue.addBulk(
        rows.map(({ id }) => ({
          name: 'send-reminder',
          data: { reminderJobId: id },
          opts: { jobId: id },
        })),
      );
      total += rows.length;
      if (rows.length < BATCH_SIZE) return total;
    }
  }

  /** Puts jobs stuck in "queued" back to "pending" so the next tick enqueues them again. */
  async requeueStale(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - STALE_QUEUED_MINUTES * 60_000);
    const [, count] = (await this.dataSource.query(
      `UPDATE reminder_jobs SET status = $1, updated_at = now()
       WHERE status = $2 AND updated_at < $3`,
      [ReminderJobStatus.Pending, ReminderJobStatus.Queued, cutoff],
    )) as [unknown[], number];
    return count;
  }
}
