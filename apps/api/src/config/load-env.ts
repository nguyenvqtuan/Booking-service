import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Nạp file .env cho các tiến trình không đi qua ConfigModule (TypeORM CLI, seed).
 * Thứ tự ưu tiên: biến môi trường có sẵn > apps/api/.env > .env ở gốc repo.
 */
export function loadEnvFiles(cwd = process.cwd()): void {
  for (const file of [resolve(cwd, '.env'), resolve(cwd, '../../.env')]) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
}

/** Danh sách file .env cho ConfigModule (file trước được ưu tiên). */
export const ENV_FILE_PATHS = ['.env', '../../.env'];
