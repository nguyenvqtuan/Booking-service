import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';
import { DEFAULT_REMINDER_OFFSETS_MIN, type ReminderSettingsDto } from '@booking/shared';
import { ReminderSetting } from '../database/entities/index.js';

export const DEFAULT_REMINDER_SETTINGS: ReminderSettingsDto = {
  offsets: DEFAULT_REMINDER_OFFSETS_MIN,
  fallbackEnabled: true,
};

@Injectable()
export class ReminderSettingsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Settings of a salon, falling back to the defaults (24h + 2h, SMS fallback on). */
  async get(
    salonId: string,
    em: EntityManager = this.dataSource.manager,
  ): Promise<ReminderSettingsDto> {
    const row = await em.findOneBy(ReminderSetting, { salonId });
    return row
      ? { offsets: row.offsets, fallbackEnabled: row.fallbackEnabled }
      : DEFAULT_REMINDER_SETTINGS;
  }

  /** Applies to appointments created or changed from now on. */
  async update(salonId: string, input: ReminderSettingsDto): Promise<ReminderSettingsDto> {
    await this.dataSource.getRepository(ReminderSetting).upsert({ salonId, ...input }, ['salonId']);
    return this.get(salonId);
  }
}
