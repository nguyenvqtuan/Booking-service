import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  REMINDER_QUEUE,
  REMINDER_QUEUE_NAME,
  type ReminderQueuePayload,
} from './queue.constants.js';
import { createRedis } from './redis.js';

export type ReminderQueue = Queue<ReminderQueuePayload>;

@Global()
@Module({
  providers: [
    {
      provide: REMINDER_QUEUE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): ReminderQueue =>
        new Queue<ReminderQueuePayload>(REMINDER_QUEUE_NAME, {
          connection: createRedis(config.getOrThrow<string>('REDIS_URL')),
          // Finished jobs are removed: the database is the source of truth, and keeping them would
          // make BullMQ silently ignore a later enqueue of the same (re-armed) reminder id.
          defaultJobOptions: { removeOnComplete: true, removeOnFail: true },
        }),
    },
  ],
  exports: [REMINDER_QUEUE],
})
export class QueueModule implements OnApplicationShutdown {
  constructor(@Inject(REMINDER_QUEUE) private readonly queue: ReminderQueue) {}

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close();
  }
}
