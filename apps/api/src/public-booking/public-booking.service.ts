import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import {
  AppointmentSource,
  ErrorCode,
  type PublicBookingParsed,
  type PublicBookingResult,
  type PublicSalonDto,
  type PublicServiceDto,
  type PublicStaffDto,
  type SlotDto,
} from '@booking/shared';
import { AppointmentsService } from '../appointments/appointments.service.js';
import { AppException } from '../common/app.exception.js';
import { CustomersService } from '../customers/customers.service.js';
import { Salon, Service, Staff, StaffService } from '../database/entities/index.js';
import { SlotsService } from '../slots/slots.service.js';

/** Anonymous online booking (BS-35). Salons are resolved by slug; only public fields are exposed. */
@Injectable()
export class PublicBookingService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly slots: SlotsService,
    private readonly customers: CustomersService,
    private readonly appointments: AppointmentsService,
  ) {}

  async salon(slug: string): Promise<PublicSalonDto> {
    const { name, slug: salonSlug, timezone } = await this.findSalon(slug);
    return { name, slug: salonSlug, timezone };
  }

  async services(slug: string): Promise<PublicServiceDto[]> {
    const salon = await this.findSalon(slug);
    const rows = await this.dataSource
      .getRepository(Service)
      .find({ where: { salonId: salon.id, isActive: true }, order: { name: 'ASC' } });
    return rows.map(({ id, name, durationMin, price }) => ({ id, name, durationMin, price }));
  }

  async staff(slug: string, serviceId?: string): Promise<PublicStaffDto[]> {
    const salon = await this.findSalon(slug);
    const rows = await this.dataSource
      .getRepository(Staff)
      .find({ where: { salonId: salon.id, isActive: true }, order: { name: 'ASC' } });
    if (!serviceId) return rows.map(({ id, name }) => ({ id, name }));
    const links = await this.dataSource
      .getRepository(StaffService)
      .findBy({ serviceId, staffId: In(rows.map((r) => r.id)) });
    const offering = new Set(links.map((l) => l.staffId));
    return rows.filter((r) => offering.has(r.id)).map(({ id, name }) => ({ id, name }));
  }

  async freeSlots(
    slug: string,
    query: { staffId: string; serviceId: string; date: string },
  ): Promise<SlotDto[]> {
    const salon = await this.findSalon(slug);
    return this.slots.find(salon.id, query);
  }

  async book(slug: string, input: PublicBookingParsed): Promise<PublicBookingResult> {
    const salon = await this.findSalon(slug);
    await this.slots.assertAvailable(salon.id, input);

    const customerId = await this.findOrCreateCustomer(salon.id, input);
    const booked = await this.appointments.create(
      salon.id,
      { customerId, staffId: input.staffId, serviceId: input.serviceId, startAt: input.startAt },
      AppointmentSource.Online,
    );
    return {
      salonName: salon.name,
      serviceName: booked.serviceName,
      staffName: booked.staffName,
      startAt: booked.startAt,
      endAt: booked.endAt,
    };
  }

  /** An existing customer keeps their stored name: anonymous input must not overwrite data. */
  private async findOrCreateCustomer(salonId: string, input: PublicBookingParsed): Promise<string> {
    const existing = await this.customers.findByPhone(salonId, input.phone);
    if (existing) return existing.id;
    try {
      const created = await this.customers.create(salonId, {
        name: input.name,
        phone: input.phone,
        ...(input.locale && { locale: input.locale }),
      });
      return created.id;
    } catch (err) {
      // Two simultaneous first bookings with the same phone.
      if (err instanceof AppException && err.code === ErrorCode.CustomerPhoneTaken) {
        const raced = await this.customers.findByPhone(salonId, input.phone);
        if (raced) return raced.id;
      }
      throw err;
    }
  }

  private async findSalon(slug: string): Promise<Salon> {
    const salon = await this.dataSource.getRepository(Salon).findOneBy({ slug });
    if (!salon) throw new NotFoundException('Salon not found');
    return salon;
  }
}
