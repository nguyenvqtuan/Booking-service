import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { loadEnvFiles } from '../../src/config/load-env.js';
import { buildDataSourceOptions, type DbEnv } from '../../src/database/typeorm.options.js';

/** DataSource for e2e tests. Expects migrations to have been run already. */
export async function createTestDataSource(): Promise<DataSource> {
  loadEnvFiles();
  const ds = new DataSource(buildDataSourceOptions(process.env as unknown as DbEnv));
  return ds.initialize();
}

/** Postgres error code of a failed query, e.g. '23503' (FK) or '23P01' (exclusion). */
export async function pgErrorCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (err) {
    return (
      (err as { code?: string; driverError?: { code?: string } }).driverError?.code ??
      (err as { code?: string }).code
    );
  }
}
