import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppointmentActionsModule } from './appointment-actions/appointment-actions.module.js';
import { AppointmentsModule } from './appointments/appointments.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { CustomersModule } from './customers/customers.module.js';
import { ENV_FILE_PATHS } from './config/load-env.js';
import { envValidationSchema } from './config/env.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { MailModule } from './mail/mail.module.js';
import { PublicBookingModule } from './public-booking/public-booking.module.js';
import { QueueModule } from './queue/queue.module.js';
import { RemindersModule } from './reminders/reminders.module.js';
import { SalonsModule } from './salons/salons.module.js';
import { ServicesModule } from './services/services.module.js';
import { SlotsModule } from './slots/slots.module.js';
import { StaffModule } from './staff/staff.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ENV_FILE_PATHS,
      validationSchema: envValidationSchema,
    }),
    DatabaseModule,
    ScheduleModule.forRoot(),
    QueueModule,
    MailModule,
    AuthModule,
    HealthModule,
    ServicesModule,
    StaffModule,
    CustomersModule,
    SalonsModule,
    AppointmentsModule,
    RemindersModule,
    SlotsModule,
    PublicBookingModule,
    AppointmentActionsModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
})
export class AppModule {}
