import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, LessThan, MoreThan } from 'typeorm';
import {
  ACTIVE_APPOINTMENT_STATUSES,
  computeSlots,
  localDayRangeUtc,
  type SlotDto,
} from '@booking/shared';
import { Appointment, Salon, Service, Staff, StaffService } from '../database/entities/index.js';
import { findOwnedOrFail } from '../tenancy/index.js';

@Injectable()
export class SlotsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Free start times of a staff member for a service on one salon-local day (BS-36). */
  async find(
    salonId: string,
    query: { staffId: string; serviceId: string; date: string },
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
}
