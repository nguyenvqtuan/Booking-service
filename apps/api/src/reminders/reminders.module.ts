import { Module } from '@nestjs/common';
import { ReminderScheduler } from './reminder-scheduler.service.js';
import { ReminderSettingsController } from './reminder-settings.controller.js';
import { ReminderSettingsService } from './reminder-settings.service.js';

@Module({
  controllers: [ReminderSettingsController],
  providers: [ReminderSettingsService, ReminderScheduler],
  exports: [ReminderSettingsService, ReminderScheduler],
})
export class RemindersModule {}
