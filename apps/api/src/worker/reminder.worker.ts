import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { REMINDER_QUEUE_NAME, type ReminderQueuePayload } from '../queue/queue.constants.js';
import { createRedis } from '../queue/redis.js';
import { backoffDelay, retryPolicyFrom } from '../queue/retry-policy.js';
import { ReminderSender } from '../reminders/reminder-sender.service.js';

class TransientSendError extends Error {
  constructor(reminderJobId: string) {
    super(`Transient failure sending reminder ${reminderJobId}`);
  }
}

/** BullMQ consumer of the reminders queue; runs in the worker process (main.worker.ts). */
@Injectable()
export class ReminderWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(ReminderWorker.name);
  private worker?: Worker<ReminderQueuePayload>;

  constructor(
    private readonly sender: ReminderSender,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const policy = retryPolicyFrom(this.config);
    this.worker = new Worker<ReminderQueuePayload>(
      REMINDER_QUEUE_NAME,
      async (job) => {
        const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
        const result = await this.sender.process(job.data.reminderJobId, { isLastAttempt });
        // Throwing makes BullMQ schedule the next attempt with the backoff below.
        if (result === 'retry') throw new TransientSendError(job.data.reminderJobId);
        return result;
      },
      {
        connection: createRedis(this.config.getOrThrow<string>('REDIS_URL')),
        concurrency: 10,
        settings: { backoffStrategy: (attemptsMade) => backoffDelay(policy, attemptsMade) },
      },
    );
    this.worker.on('failed', (job, err) => {
      if (err instanceof TransientSendError) {
        this.logger.warn(`Reminder ${job?.data.reminderJobId}: transient failure, retry scheduled`);
      } else {
        this.logger.error(`Reminder ${job?.data.reminderJobId} failed: ${err.message}`);
      }
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }
}
