import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module.js';
import { CustomersModule } from '../customers/customers.module.js';
import { MessagingModule } from '../messaging/messaging.module.js';
import { SlotsModule } from '../slots/slots.module.js';
import { OtpService } from './otp.service.js';
import { PublicBookingController } from './public-booking.controller.js';
import { PublicBookingService } from './public-booking.service.js';

@Module({
  imports: [AppointmentsModule, CustomersModule, SlotsModule, MessagingModule],
  controllers: [PublicBookingController],
  providers: [PublicBookingService, OtpService],
})
export class PublicBookingModule {}
