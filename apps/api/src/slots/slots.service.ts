import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, LessThan, MoreThan, Not } from 'typeorm';
import {
  ACTIVE_APPOINTMENT_STATUSES,
  computeSlots,
  ErrorCode,
  localDayRangeUtc,
  type SlotDto,
  utcToLocal,
} from '@booking/shared';
import { AppException } from '../common/app.exception.js';
import { Appointment, Salon, Service, Staff, StaffService } from '../database/entities/index.js';
import { findOwnedOrFail } from '../tenancy/index.js';

@Injectable()
export class SlotsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Free start times of a staff member for a service on one salon-local day (BS-36). */
  async find(
    salonId: string,
    query: { staffId: string; serviceId: string; date: string; excludeAppointmentId?: string },
    now: Date = new Date(),
  ): Promise<SlotDto[]> {
    const em = this.dataSource.manager;
    const staff = await findOwnedOrFail(em.getRepository(Staff), query.staffId, salonId);
    const service = await findOwnedOrFail(em.getRepository(Service), query.serviceId, salonId);
    const offered = await em.exists(StaffService, {
      where: { staffId: staff.id, serviceId: service.id },
    });
    if (!staff.isActive || !service.isActive || !offered) return [];

    const { timezone } = await em.findOneByOrFail(Salon, { id: salonId });
    const { from, to } = localDayRangeUtc(query.date, timezone);
    const appointments = await em.findBy(Appointment, {
      salonId,
      staffId: staff.id,
      status: In([...ACTIVE_APPOINTMENT_STATUSES]),
      startAt: LessThan(to),
      endAt: MoreThan(from),
      ...(query.excludeAppointmentId && { id: Not(query.excludeAppointmentId) }),
    });

    return computeSlots({
      workingHours: staff.workingHours,
      busy: appointments.map((a) => ({ start: a.startAt, end: a.endAt })),
      durationMin: service.durationMin,
      date: query.date,
      timeZone: timezone,
      now,
    });
  }

  /** Customers may only choose a time the salon offers (working hours, not past, not taken). */
  async assertAvailable(
    salonId: string,
    input: { staffId: string; serviceId: string; startAt: string; excludeAppointmentId?: string },
  ): Promise<void> {
    const startAt = new Date(input.startAt);
    const { timezone } = await this.dataSource.manager.findOneByOrFail(Salon, { id: salonId });
    const free = await this.find(salonId, {
      staffId: input.staffId,
      serviceId: input.serviceId,
      date: utcToLocal(startAt, timezone).date,
      excludeAppointmentId: input.excludeAppointmentId,
    });
    if (!free.some((slot) => new Date(slot.startAt).getTime() === startAt.getTime())) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.SlotUnavailable,
        'This time is not available',
      );
    }
  }
}
