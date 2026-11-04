import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { ReminderJobStatus } from '@booking/shared';
import type { ReminderQueue } from '../queue/queue.module.js';
import { REMINDER_QUEUE } from '../queue/queue.constants.js';
import { REMINDER_BACKOFF_TYPE, type RetryPolicy, retryPolicyFrom } from '../queue/retry-policy.js';

const BATCH_SIZE = 500;
/** A job still "queued" after this long was probably lost (e.g. Redis down after the DB update). */
const STALE_QUEUED_MINUTES = 10;
/** Longer than the largest retry delay: a "retrying" job this old lost its queue entry. */
const STALE_RETRYING_MINUTES = 30;
/** A job still "sending" after this long belongs to a worker that died mid-send. */
const STUCK_SENDING_MINUTES = 30;

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
  ) {
    this.retry = retryPolicyFrom(config);
  }

  private readonly retry: RetryPolicy;

  @Cron(CronExpression.EVERY_MINUTE, { name: 'reminder-dispatch' })
  async tick(): Promise<void> {
    if (!this.config.get<boolean>('REMINDER_CRON_ENABLED')) return;
    try {
      await this.requeueStale();
      await this.failStuckSending();
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
          opts: {
            jobId: id,
            attempts: this.retry.attempts,
            backoff: { type: REMINDER_BACKOFF_TYPE },
          },
        })),
      );
      total += rows.length;
      if (rows.length < BATCH_SIZE) return total;
    }
  }

  /**
   * A worker died while sending: the message may or may not have gone out, so the job is
   * failed rather than re-sent. A missing reminder is better than a duplicate one (BS-33).
   */
  async failStuckSending(now: Date = new Date()): Promise<number> {
    const [, count] = (await this.dataSource.query(
      `UPDATE reminder_jobs SET status = $1, last_error = $2, updated_at = now()
       WHERE status = $3 AND updated_at < $4`,
      [
        ReminderJobStatus.Failed,
        'Worker stopped while sending; delivery unknown, not retried',
        ReminderJobStatus.Sending,
        new Date(now.getTime() - STUCK_SENDING_MINUTES * 60_000),
      ],
    )) as [unknown[], number];
    return count;
  }

  /** Puts jobs stuck in "queued"/"retrying" back to "pending" so the next tick enqueues them again. */
  async requeueStale(now: Date = new Date()): Promise<number> {
    const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
    const [, count] = (await this.dataSource.query(
      `UPDATE reminder_jobs SET status = $1, updated_at = now()
       WHERE (status = $2 AND updated_at < $3) OR (status = $4 AND updated_at < $5)`,
      [
        ReminderJobStatus.Pending,
        ReminderJobStatus.Queued,
        minutesAgo(STALE_QUEUED_MINUTES),
        ReminderJobStatus.Retrying,
        minutesAgo(STALE_RETRYING_MINUTES),
      ],
    )) as [unknown[], number];
    return count;
  }
}
