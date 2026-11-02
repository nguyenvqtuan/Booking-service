import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager, In } from 'typeorm';
import {
  ErrorCode,
  type StaffDto,
  type StaffInputParsed,
  type StaffUpdateParsed,
  WEEKDAYS,
  type WorkingHours,
} from '@booking/shared';
import { AppException } from '../common/app.exception.js';
import { Appointment, Service, Staff, StaffService } from '../database/entities/index.js';
import { findOwnedOrFail } from '../tenancy/index.js';

/** Older rows may miss weekday keys; always expose all 7 days. */
const fullWeek = (wh: WorkingHours): StaffDto['workingHours'] =>
  Object.fromEntries(WEEKDAYS.map((d) => [d, wh[d] ?? []])) as StaffDto['workingHours'];

@Injectable()
export class StaffMembersService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async list(salonId: string, includeInactive: boolean): Promise<StaffDto[]> {
    const rows = await this.dataSource.getRepository(Staff).find({
      where: includeInactive ? { salonId } : { salonId, isActive: true },
      order: { isActive: 'DESC', name: 'ASC' },
    });
    const links = rows.length
      ? await this.dataSource
          .getRepository(StaffService)
          .findBy({ staffId: In(rows.map((r) => r.id)) })
      : [];
    return rows.map((r) =>
      this.toDto(
        r,
        links.filter((l) => l.staffId === r.id).map((l) => l.serviceId),
      ),
    );
  }

  async get(salonId: string, id: string): Promise<StaffDto> {
    const staff = await findOwnedOrFail(this.dataSource.getRepository(Staff), id, salonId);
    return this.toDto(staff, await this.serviceIdsOf(staff.id));
  }

  async create(salonId: string, input: StaffInputParsed): Promise<StaffDto> {
    const id = await this.dataSource.transaction(async (em) => {
      const { serviceIds, ...fields } = input;
      const staff = await em.save(em.create(Staff, { ...fields, salonId }));
      await this.replaceServices(em, salonId, staff.id, serviceIds);
      return staff.id;
    });
    return this.get(salonId, id);
  }

  async update(salonId: string, id: string, input: StaffUpdateParsed): Promise<StaffDto> {
    await this.dataSource.transaction(async (em) => {
      const staff = await findOwnedOrFail(em.getRepository(Staff), id, salonId);
      const { serviceIds, ...fields } = input;
      await em.save(em.merge(Staff, staff, fields));
      if (serviceIds) await this.replaceServices(em, salonId, staff.id, serviceIds);
    });
    return this.get(salonId, id);
  }

  /** Staff with appointments cannot be hard-deleted; deactivate them instead. */
  async remove(salonId: string, id: string): Promise<void> {
    const staff = await findOwnedOrFail(this.dataSource.getRepository(Staff), id, salonId);
    if (await this.dataSource.getRepository(Appointment).exists({ where: { staffId: staff.id } })) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.StaffInUse,
        'Staff member has appointments; deactivate instead',
      );
    }
    await this.dataSource.getRepository(Staff).delete({ id: staff.id, salonId });
  }

  /** Replaces the staff's services; every service must belong to the same salon. */
  private async replaceServices(
    em: EntityManager,
    salonId: string,
    staffId: string,
    serviceIds: string[],
  ): Promise<void> {
    const unique = [...new Set(serviceIds)];
    if (unique.length) {
      const owned = await em.countBy(Service, { id: In(unique), salonId });
      if (owned !== unique.length) {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.ValidationFailed,
          'Unknown service',
          { serviceIds: ['Unknown service'] },
        );
      }
    }
    await em.delete(StaffService, { staffId });
    if (unique.length) {
      await em.insert(
        StaffService,
        unique.map((serviceId) => ({ staffId, serviceId })),
      );
    }
  }

  private async serviceIdsOf(staffId: string): Promise<string[]> {
    const links = await this.dataSource.getRepository(StaffService).findBy({ staffId });
    return links.map((l) => l.serviceId);
  }

  private toDto(staff: Staff, serviceIds: string[]): StaffDto {
    return {
      id: staff.id,
      name: staff.name,
      phone: staff.phone,
      workingHours: fullWeek(staff.workingHours),
      isActive: staff.isActive,
      serviceIds: serviceIds.sort(),
    };
  }
}
