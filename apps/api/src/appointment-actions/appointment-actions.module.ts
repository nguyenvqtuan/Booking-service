import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module.js';
import { SlotsModule } from '../slots/slots.module.js';
import { ActionTokenService } from './action-token.service.js';
import { AppointmentActionsController } from './appointment-actions.controller.js';
import { AppointmentActionsService } from './appointment-actions.service.js';

@Module({
  imports: [AppointmentsModule, SlotsModule],
  controllers: [AppointmentActionsController],
  providers: [ActionTokenService, AppointmentActionsService],
  exports: [ActionTokenService],
})
export class AppointmentActionsModule {}
