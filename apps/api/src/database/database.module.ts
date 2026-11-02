import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildDataSourceOptions, type DbEnv } from './typeorm.options.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildDataSourceOptions({
          DB_HOST: config.getOrThrow('DB_HOST'),
          DB_PORT: config.getOrThrow('DB_PORT'),
          DB_USER: config.getOrThrow('DB_USER'),
          DB_PASSWORD: config.getOrThrow('DB_PASSWORD'),
          DB_NAME: config.getOrThrow('DB_NAME'),
          DB_SSL: config.get('DB_SSL'),
          DB_LOGGING: config.get('DB_LOGGING'),
        } satisfies DbEnv),
    }),
  ],
})
export class DatabaseModule {}
