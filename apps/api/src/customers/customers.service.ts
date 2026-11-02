import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  type CustomerDetailDto,
  type CustomerDto,
  type CustomerInputParsed,
  type CustomerUpdateParsed,
  ErrorCode,
  type Page,
  phoneSearchDigits,
} from '@booking/shared';
import { AppException } from '../common/app.exception.js';
import { isPgError, PgErrorCode } from '../common/pg-errors.js';
import { Appointment, Customer } from '../database/entities/index.js';
import { findOwnedOrFail } from '../tenancy/index.js';

const HISTORY_LIMIT = 20;

const toDto = (c: Customer): CustomerDto => ({
  id: c.id,
  name: c.name,
  phone: c.phone,
  note: c.note,
  locale: c.locale,
  noShowCount: c.noShowCount,
});

const phoneTaken = () =>
  new AppException(
    HttpStatus.CONFLICT,
    ErrorCode.CustomerPhoneTaken,
    'A customer with this phone already exists',
    { phone: ['Phone already used by another customer'] },
  );

/** Escapes LIKE wildcards in user input. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    @InjectRepository(Appointment) private readonly appointments: Repository<Appointment>,
  ) {}

  /** Search by name (accent-insensitive) or by phone in any typed format. */
  async list(
    salonId: string,
    query: { q?: string; limit: number; offset: number },
  ): Promise<Page<CustomerDto>> {
    const qb = this.customers
      .createQueryBuilder('c')
      .where('c.salon_id = :salonId', { salonId })
      .orderBy('c.name', 'ASC')
      .addOrderBy('c.id', 'ASC')
      .take(query.limit)
      .skip(query.offset);

    const q = query.q?.trim();
    if (q) {
      const digits = phoneSearchDigits(q);
      const conditions = [`unaccent(c.name) ILIKE unaccent(:name)`];
      if (digits.length >= 3) conditions.push(`c.phone LIKE :phone`);
      qb.andWhere(`(${conditions.join(' OR ')})`, {
        name: `%${likeEscape(q)}%`,
        phone: `%${digits}%`,
      });
    }

    const [rows, total] = await qb.getManyAndCount();
    return { items: rows.map(toDto), total };
  }

  async get(salonId: string, id: string): Promise<CustomerDetailDto> {
    const customer = await findOwnedOrFail(this.customers, id, salonId);
    const history = await this.appointments.find({
      where: { salonId, customerId: customer.id },
      relations: { service: true, staff: true },
      order: { startAt: 'DESC' },
      take: HISTORY_LIMIT,
    });
    return {
      ...toDto(customer),
      history: history.map((a) => ({
        id: a.id,
        startAt: a.startAt.toISOString(),
        status: a.status,
        serviceName: a.service.name,
        staffName: a.staff.name,
      })),
    };
  }

  /** Looks a customer up by (already normalized) phone; used by online booking (BS-35). */
  findByPhone(salonId: string, phone: string): Promise<Customer | null> {
    return this.customers.findOneBy({ salonId, phone });
  }

  async create(salonId: string, input: CustomerInputParsed): Promise<CustomerDto> {
    if (await this.customers.exists({ where: { salonId, phone: input.phone } })) throw phoneTaken();
    try {
      return toDto(await this.customers.save(this.customers.create({ ...input, salonId })));
    } catch (err) {
      if (isPgError(err, PgErrorCode.UniqueViolation, 'UQ_customers_salon_phone'))
        throw phoneTaken();
      throw err;
    }
  }

  async update(salonId: string, id: string, input: CustomerUpdateParsed): Promise<CustomerDto> {
    const customer = await findOwnedOrFail(this.customers, id, salonId);
    try {
      return toDto(await this.customers.save(this.customers.merge(customer, input)));
    } catch (err) {
      if (isPgError(err, PgErrorCode.UniqueViolation, 'UQ_customers_salon_phone'))
        throw phoneTaken();
      throw err;
    }
  }

  async remove(salonId: string, id: string): Promise<void> {
    const customer = await findOwnedOrFail(this.customers, id, salonId);
    if (await this.appointments.exists({ where: { customerId: customer.id } })) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.CustomerInUse,
        'Customer has appointments and cannot be deleted',
      );
    }
    await this.customers.delete({ id: customer.id, salonId });
  }
}
