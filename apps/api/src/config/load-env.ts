import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Loads .env files for processes that do not go through ConfigModule (TypeORM CLI, seed).
 * Precedence: existing environment variables > apps/api/.env > repo-root .env.
 */
export function loadEnvFiles(cwd = process.cwd()): void {
  for (const file of [resolve(cwd, '.env'), resolve(cwd, '../../.env')]) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
}

/** .env file paths for ConfigModule (earlier files take precedence). */
export const ENV_FILE_PATHS = ['.env', '../../.env'];
