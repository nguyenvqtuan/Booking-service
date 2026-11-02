import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErrorCode, type ServiceDto, type ServiceInput, type ServiceUpdate } from '@booking/shared';
import { AppException } from '../common/app.exception.js';
import { Appointment, Service } from '../database/entities/index.js';
import { findOwnedOrFail } from '../tenancy/index.js';

const toDto = (s: Service): ServiceDto => ({
  id: s.id,
  name: s.name,
  durationMin: s.durationMin,
  price: s.price,
  isActive: s.isActive,
});

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service) private readonly services: Repository<Service>,
    @InjectRepository(Appointment) private readonly appointments: Repository<Appointment>,
  ) {}

  async list(salonId: string, includeInactive: boolean): Promise<ServiceDto[]> {
    const rows = await this.services.find({
      where: includeInactive ? { salonId } : { salonId, isActive: true },
      order: { isActive: 'DESC', name: 'ASC' },
    });
    return rows.map(toDto);
  }

  async create(salonId: string, input: ServiceInput): Promise<ServiceDto> {
    return toDto(await this.services.save(this.services.create({ ...input, salonId })));
  }

  async update(salonId: string, id: string, input: ServiceUpdate): Promise<ServiceDto> {
    const service = await findOwnedOrFail(this.services, id, salonId);
    return toDto(await this.services.save(this.services.merge(service, input)));
  }

  /**
   * Hard delete is only allowed while no appointment references the service;
   * otherwise the service must be hidden (isActive = false) to keep history intact.
   */
  async remove(salonId: string, id: string): Promise<void> {
    const service = await findOwnedOrFail(this.services, id, salonId);
    if (await this.appointments.exists({ where: { serviceId: service.id } })) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.ServiceInUse,
        'Service has appointments; hide it instead',
      );
    }
    await this.services.delete({ id: service.id, salonId });
  }
}
