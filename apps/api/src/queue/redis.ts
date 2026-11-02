import { Redis } from 'ioredis';

/**
 * BullMQ requires `maxRetriesPerRequest: null` for blocking (worker) connections.
 * Each Queue/Worker gets its own connection.
 */
export function createRedis(url: string): Redis {
  return new Redis(url, { maxRetriesPerRequest: null });
}
