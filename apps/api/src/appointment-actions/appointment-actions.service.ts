import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import type {
  AppointmentActionView,
  AppointmentDto,
  AppointmentStatus,
  SlotDto,
} from '@booking/shared';
import { AppointmentsService } from '../appointments/appointments.service.js';
import { Salon } from '../database/entities/index.js';
import { SlotsService } from '../slots/slots.service.js';
import { ActionTokenService } from './action-token.service.js';

@Injectable()
export class AppointmentActionsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly tokens: ActionTokenService,
    private readonly appointments: AppointmentsService,
    private readonly slotsService: SlotsService,
  ) {}

  async view(rawToken: string): Promise<AppointmentActionView> {
    const token = await this.tokens.peek(rawToken);
    const appointment = await this.appointments.get(token.salonId, token.appointmentId);
    return this.toView(token.salonId, appointment);
  }

  async slots(rawToken: string, date: string): Promise<SlotDto[]> {
    const token = await this.tokens.peek(rawToken);
    const appointment = await this.appointments.get(token.salonId, token.appointmentId);
    return this.slotsService.find(token.salonId, {
      staffId: appointment.staffId,
      serviceId: appointment.serviceId,
      date,
      excludeAppointmentId: appointment.id,
    });
  }

  changeStatus(rawToken: string, status: AppointmentStatus): Promise<AppointmentActionView> {
    return this.tokens.consume(rawToken, async (em, token) => {
      const updated = await this.appointments.changeStatus(
        token.salonId,
        token.appointmentId,
        status,
        em,
      );
      return this.toView(token.salonId, updated, em);
    });
  }

  reschedule(rawToken: string, startAt: string): Promise<AppointmentActionView> {
    return this.tokens.consume(rawToken, async (em, token) => {
      const current = await this.appointments.get(token.salonId, token.appointmentId, em);
      await this.slotsService.assertAvailable(token.salonId, {
        staffId: current.staffId,
        serviceId: current.serviceId,
        startAt,
        excludeAppointmentId: current.id,
      });
      const updated = await this.appointments.update(
        token.salonId,
        token.appointmentId,
        { startAt },
        em,
      );
      return this.toView(token.salonId, updated, em);
    });
  }

  private async toView(
    salonId: string,
    a: AppointmentDto,
    em: EntityManager = this.dataSource.manager,
  ): Promise<AppointmentActionView> {
    const salon = await em.findOneByOrFail(Salon, { id: salonId });
    return {
      salonName: salon.name,
      timezone: salon.timezone,
      serviceName: a.serviceName,
      staffName: a.staffName,
      startAt: a.startAt,
      endAt: a.endAt,
      status: a.status,
    };
  }
}
