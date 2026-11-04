import type { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import type { ReminderQueue } from '../queue/queue.module.js';
import { ReminderDispatcher } from './reminder-dispatcher.service.js';

function createDispatcher(cronEnabled: boolean) {
  const query = vi.fn().mockResolvedValue([[], 0]);
  const dispatcher = new ReminderDispatcher(
    { query } as unknown as DataSource,
    { addBulk: vi.fn() } as unknown as ReminderQueue,
    {
      get: (key: string) => (key === 'REMINDER_CRON_ENABLED' ? cronEnabled : undefined),
    } as unknown as ConfigService,
  );
  return { dispatcher, query };
}

describe('ReminderDispatcher.tick', () => {
  it('does nothing when the cron is disabled on this instance', async () => {
    const { dispatcher, query } = createDispatcher(false);
    await dispatcher.tick();
    expect(query).not.toHaveBeenCalled();
  });

  it('recovers stale jobs and dispatches when enabled', async () => {
    const { dispatcher, query } = createDispatcher(true);
    await dispatcher.tick();
    expect(query).toHaveBeenCalledTimes(3); // requeueStale, failStuckSending, dispatchDue
  });

  it('never throws: a database or Redis outage must not crash the API', async () => {
    const { dispatcher, query } = createDispatcher(true);
    query.mockRejectedValueOnce(new Error('connection lost'));
    await expect(dispatcher.tick()).resolves.toBeUndefined();
  });
});
