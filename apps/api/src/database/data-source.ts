import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { loadEnvFiles } from '../config/load-env.js';
import { buildDataSourceOptions, type DbEnv } from './typeorm.options.js';

// DataSource cho TypeORM CLI (migration:generate/run/revert).
loadEnvFiles();

export default new DataSource(buildDataSourceOptions(process.env as unknown as DbEnv));
