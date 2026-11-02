import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DataSourceOptions } from 'typeorm';
import { ENTITIES } from './entities.js';

const here = dirname(fileURLToPath(import.meta.url));

export interface DbEnv {
  DB_HOST: string;
  DB_PORT: number | string;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  DB_SSL?: boolean | string;
  DB_LOGGING?: boolean | string;
}

const toBool = (v: boolean | string | undefined) => v === true || v === 'true';

/** DataSource options shared by Nest (DatabaseModule) and the TypeORM CLI. */
export function buildDataSourceOptions(env: DbEnv): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: toBool(env.DB_SSL) ? { rejectUnauthorized: false } : false,
    logging: toBool(env.DB_LOGGING),
    entities: ENTITIES,
    migrations: [join(here, 'migrations', '*.{ts,js}')],
    migrationsTableName: 'migrations',
    // Always use migrations; never let TypeORM alter the schema automatically.
    synchronize: false,
    migrationsRun: false,
  };
}
