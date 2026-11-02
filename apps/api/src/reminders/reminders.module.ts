import { Module } from '@nestjs/common';
import { ReminderDispatcher } from './reminder-dispatcher.service.js';
import { ReminderScheduler } from './reminder-scheduler.service.js';
import { ReminderSettingsController } from './reminder-settings.controller.js';
import { ReminderSettingsService } from './reminder-settings.service.js';

@Module({
  controllers: [ReminderSettingsController],
  providers: [ReminderSettingsService, ReminderScheduler, ReminderDispatcher],
  exports: [ReminderSettingsService, ReminderScheduler, ReminderDispatcher],
})
export class RemindersModule {}
