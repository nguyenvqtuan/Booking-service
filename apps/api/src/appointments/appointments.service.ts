import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';
import {
  addMinutes,
  type AppointmentCreateParsed,
  type AppointmentDto,
  AppointmentSource,
  AppointmentStatus,
  type AppointmentUpdateParsed,
  canTransition,
  ErrorCode,
  isActiveStatus,
} from '@booking/shared';
import { AppException } from '../common/app.exception.js';
import { isPgError, PgErrorCode } from '../common/pg-errors.js';
import { Appointment, Customer, Service, Staff, StaffService } from '../database/entities/index.js';
import { ReminderScheduler } from '../reminders/reminder-scheduler.service.js';
import { findOwnedOrFail } from '../tenancy/index.js';

const overlap = () =>
  new AppException(
    HttpStatus.CONFLICT,
    ErrorCode.AppointmentOverlap,
    'The staff member already has an appointment at this time',
  );

interface ResolvedRefs {
  customer: Customer;
  staff: Staff;
  service: Service;
}

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly reminders: ReminderScheduler,
  ) {}

  /** Appointments overlapping [from, to), optionally for one staff member. */
  async list(
    salonId: string,
    query: { from: string; to: string; staffId?: string },
  ): Promise<AppointmentDto[]> {
    const qb = this.baseQuery(salonId)
      .andWhere('a.start_at < :to AND a.end_at > :from', { from: query.from, to: query.to })
      .orderBy('a.start_at', 'ASC');
    if (query.staffId) qb.andWhere('a.staff_id = :staffId', { staffId: query.staffId });
    return (await qb.getRawMany<RawAppointment>()).map(toDto);
  }

  async get(
    salonId: string,
    id: string,
    em: EntityManager = this.dataSource.manager,
  ): Promise<AppointmentDto> {
    const row = await this.baseQuery(salonId, em)
      .andWhere('a.id = :id', { id })
      .getRawOne<RawAppointment>();
    if (!row)
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.NotFound, 'Appointment not found');
    return { ...toDto(row), reminders: await this.reminders.listFor(em, row.id) };
  }

  async create(
    salonId: string,
    input: AppointmentCreateParsed,
    source: AppointmentSource = AppointmentSource.Admin,
  ): Promise<AppointmentDto> {
    return this.writeGuarded(async (em) => {
      const refs = await this.resolveRefs(em, salonId, input);
      const startAt = new Date(input.startAt);
      const saved = await em.save(
        em.create(Appointment, {
          salonId,
          customerId: refs.customer.id,
          staffId: refs.staff.id,
          serviceId: refs.service.id,
          startAt,
          endAt: addMinutes(startAt, refs.service.durationMin),
          status: AppointmentStatus.Booked,
          source,
          note: input.note ?? null,
        }),
      );
      await this.reminders.sync(em, saved);
      return this.get(salonId, saved.id, em);
    });
  }

  /** Reschedule / reassign / edit an active appointment; end_at follows the (new) service duration. */
  async update(
    salonId: string,
    id: string,
    input: AppointmentUpdateParsed,
    outer?: EntityManager,
  ): Promise<AppointmentDto> {
    return this.writeGuarded(async (em) => {
      const appt = await findOwnedOrFail(em.getRepository(Appointment), id, salonId);
      if (!isActiveStatus(appt.status)) {
        throw new AppException(
          HttpStatus.CONFLICT,
          ErrorCode.AppointmentNotEditable,
          `A ${appt.status} appointment cannot be edited`,
        );
      }
      const refs = await this.resolveRefs(em, salonId, {
        customerId: input.customerId ?? appt.customerId,
        staffId: input.staffId ?? appt.staffId,
        serviceId: input.serviceId ?? appt.serviceId,
      });
      const startAt = input.startAt ? new Date(input.startAt) : appt.startAt;
      await em.update(
        Appointment,
        { id: appt.id, salonId },
        {
          customerId: refs.customer.id,
          staffId: refs.staff.id,
          serviceId: refs.service.id,
          startAt,
          endAt: addMinutes(startAt, refs.service.durationMin),
          ...(input.note !== undefined && { note: input.note }),
        },
      );
      await this.reminders.sync(em, await em.findOneByOrFail(Appointment, { id: appt.id }));
      return this.get(salonId, appt.id, em);
    }, outer);
  }

  /** Applies a state-machine transition (confirm / cancel / complete). */
  async changeStatus(
    salonId: string,
    id: string,
    status: AppointmentStatus,
    outer?: EntityManager,
  ): Promise<AppointmentDto> {
    const run = async (em: EntityManager) => {
      const appt = await findOwnedOrFail(em.getRepository(Appointment), id, salonId);
      if (!canTransition(appt.status, status)) {
        throw new AppException(
          HttpStatus.CONFLICT,
          ErrorCode.AppointmentInvalidTransition,
          `Cannot change a ${appt.status} appointment to ${status}`,
        );
      }
      // Conditional update: a concurrent transition of the same appointment cannot both win.
      const { affected } = await em.update(
        Appointment,
        { id: appt.id, salonId, status: appt.status },
        { status },
      );
      if (!affected) {
        throw new AppException(
          HttpStatus.CONFLICT,
          ErrorCode.AppointmentInvalidTransition,
          'The appointment was changed concurrently',
        );
      }
      await this.reminders.sync(em, { ...appt, status });
      return this.get(salonId, appt.id, em);
    };
    return outer ? run(outer) : this.dataSource.transaction(run);
  }

  /**
   * Checks implicit references (BS-70): every id must exist in the caller's salon, staff and
   * service must be active and the staff member must offer the service.
   */
  private async resolveRefs(
    em: EntityManager,
    salonId: string,
    ids: { customerId: string; staffId: string; serviceId: string },
  ): Promise<ResolvedRefs> {
    const [customer, staff, service] = await Promise.all([
      em.findOneBy(Customer, { id: ids.customerId, salonId }),
      em.findOneBy(Staff, { id: ids.staffId, salonId }),
      em.findOneBy(Service, { id: ids.serviceId, salonId }),
    ]);
    const missing = Object.entries({ customerId: customer, staffId: staff, serviceId: service })
      .filter(([, v]) => !v)
      .map(([k]) => k);
    if (missing.length) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ValidationFailed,
        'Unknown reference',
        Object.fromEntries(missing.map((k) => [k, ['Not found in this salon']])),
      );
    }
    if (!staff!.isActive || !service!.isActive) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ReferenceInactive,
        'Staff member or service is inactive',
        { [!staff!.isActive ? 'staffId' : 'serviceId']: ['Inactive'] },
      );
    }
    if (
      !(await em.exists(StaffService, { where: { staffId: staff!.id, serviceId: service!.id } }))
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.StaffCannotPerformService,
        'This staff member does not offer this service',
        { staffId: ['Does not offer this service'] },
      );
    }
    return { customer: customer!, staff: staff!, service: service! };
  }

  /** Runs a write in a transaction and maps the no-overlap exclusion violation to 409. */
  private async writeGuarded<T>(
    work: (em: EntityManager) => Promise<T>,
    outer?: EntityManager,
  ): Promise<T> {
    try {
      return await (outer ? work(outer) : this.dataSource.transaction(work));
    } catch (err) {
      if (isPgError(err, PgErrorCode.ExclusionViolation, 'EXCL_appointments_staff_no_overlap')) {
        throw overlap();
      }
      throw err;
    }
  }

  /** Appointment rows with names, joined through implicit relations within the same salon. */
  private baseQuery(salonId: string, em: EntityManager = this.dataSource.manager) {
    return em
      .createQueryBuilder(Appointment, 'a')
      .innerJoin(Customer, 'c', 'c.id = a.customer_id AND c.salon_id = a.salon_id')
      .innerJoin(Staff, 'st', 'st.id = a.staff_id AND st.salon_id = a.salon_id')
      .innerJoin(Service, 'sv', 'sv.id = a.service_id AND sv.salon_id = a.salon_id')
      .select([
        'a.id AS id',
        'a.customer_id AS "customerId"',
        'c.name AS "customerName"',
        'c.phone AS "customerPhone"',
        'a.staff_id AS "staffId"',
        'st.name AS "staffName"',
        'a.service_id AS "serviceId"',
        'sv.name AS "serviceName"',
        'a.start_at AS "startAt"',
        'a.end_at AS "endAt"',
        'a.status AS status',
        'a.source AS source',
        'a.note AS note',
      ])
      .where('a.salon_id = :salonId', { salonId });
  }
}

type RawAppointment = Omit<AppointmentDto, 'startAt' | 'endAt'> & { startAt: Date; endAt: Date };

const toDto = (r: RawAppointment): AppointmentDto => ({
  ...r,
  startAt: new Date(r.startAt).toISOString(),
  endAt: new Date(r.endAt).toISOString(),
});
