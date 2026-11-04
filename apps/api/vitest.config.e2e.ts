import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    // Set here, not in test code: ConfigModule validates the environment at import time.
    env: {
      // Tests drive the reminder dispatcher explicitly instead of waiting for the cron.
      REMINDER_CRON_ENABLED: 'false',
      // Short retry delays so the real BullMQ backoff runs in milliseconds.
      REMINDER_RETRY_DELAYS_MS: '100,100,100',
      MESSAGE_PROVIDER: 'fake',
      // Suites call public routes many times from one IP; the rate limit test lowers it.
      PUBLIC_RATE_LIMIT_PER_MIN: '100000',
    },
    fileParallelism: false,
    coverage: {
      include: ['src/**'],
      exclude: [
        'src/**/*.spec.ts',
        'src/database/migrations/**',
        'src/main*.ts',
        'src/database/seeds/run-seed.ts',
      ],
      thresholds: { lines: 85, functions: 85 },
    },
    hookTimeout: 30000,
  },
});
