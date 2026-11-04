import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ENV_FILE_PATHS } from '../config/load-env.js';
import { envValidationSchema } from '../config/env.validation.js';
import { DatabaseModule } from '../database/database.module.js';
import { MessagingModule } from '../messaging/messaging.module.js';
import { ReminderSender } from '../reminders/reminder-sender.service.js';
import { ReminderSettingsService } from '../reminders/reminder-settings.service.js';
import { ReminderWorker } from './reminder.worker.js';

/** Everything the reminder worker process needs, without the HTTP API. */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ENV_FILE_PATHS,
      validationSchema: envValidationSchema,
    }),
    DatabaseModule,
    MessagingModule,
  ],
  providers: [ReminderSender, ReminderSettingsService, ReminderWorker],
})
export class WorkerModule {}
