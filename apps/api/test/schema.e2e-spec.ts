import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { addMinutes, AppointmentStatus, localToUtc, utcToLocal } from '@booking/shared';
import {
  Appointment,
  Customer,
  ReminderJob,
  Salon,
  Service,
  Staff,
} from '../src/database/entities/index.js';
import { DEMO_SALON_SLUG, seedDemoSalon } from '../src/database/seeds/demo-salon.seed.js';
import { createTestDataSource, pgErrorCode } from './utils/test-data-source.js';

const EXPECTED_TABLES = [
  'appointments',
  'customers',
  'message_logs',
  'reminder_jobs',
  'reminder_settings',
  'salons',
  'services',
  'staff',
  'staff_services',
  'users',
];

describe('database schema (e2e)', () => {
  let ds: DataSource;
  let salon: Salon;
  let staff: Staff;
  let otherStaff: Staff;
  let service: Service;
  let customer: Customer;

  const at = (iso: string) => new Date(iso);
  const appointment = (overrides: Partial<Appointment> = {}) =>
    ds.getRepository(Appointment).insert({
      salonId: salon.id,
      customerId: customer.id,
      staffId: staff.id,
      serviceId: service.id,
      startAt: at('2030-01-01T08:00:00Z'),
      endAt: at('2030-01-01T09:00:00Z'),
      ...overrides,
    });

  beforeAll(async () => {
    ds = await createTestDataSource();
    salon = await ds
      .getRepository(Salon)
      .save({ name: 'Schema test', slug: `schema-test-${randomUUID()}` });
    [staff, otherStaff] = await ds.getRepository(Staff).save([
      { salonId: salon.id, name: 'Staff A' },
      { salonId: salon.id, name: 'Staff B' },
    ]);
    service = await ds
      .getRepository(Service)
      .save({ salonId: salon.id, name: 'Cut', durationMin: 60, price: 100000 });
    customer = await ds
      .getRepository(Customer)
      .save({ salonId: salon.id, name: 'Customer', phone: '+84900000001' });
  });

  afterEach(async () => {
    await ds.getRepository(Appointment).delete({ salonId: salon.id });
  });

  afterAll(async () => {
    // ON DELETE CASCADE removes all rows created for this salon.
    await ds?.getRepository(Salon).delete({ id: salon.id });
    await ds?.destroy();
  });

  it('creates all tables', async () => {
    const rows: { table_name: string }[] = await ds.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const names = rows.map((r) => r.table_name);
    expect(names).toEqual(expect.arrayContaining(EXPECTED_TABLES));
  });

  it('applies column defaults', async () => {
    expect(salon.timezone).toBe('Asia/Ho_Chi_Minh');
    expect(staff.workingHours).toEqual({});
    expect(staff.isActive).toBe(true);
    expect(customer.noShowCount).toBe(0);
  });

  it('rejects appointments referencing a missing customer (FK)', async () => {
    expect(await pgErrorCode(appointment({ customerId: randomUUID() }))).toBe('23503');
  });

  it('rejects non-positive service duration and negative price (CHECK)', async () => {
    const repo = ds.getRepository(Service);
    expect(await pgErrorCode(repo.insert({ salonId: salon.id, name: 'x', durationMin: 0 }))).toBe(
      '23514',
    );
    expect(
      await pgErrorCode(repo.insert({ salonId: salon.id, name: 'x', durationMin: 30, price: -1 })),
    ).toBe('23514');
  });

  it('rejects end_at <= start_at (CHECK)', async () => {
    expect(await pgErrorCode(appointment({ endAt: at('2030-01-01T08:00:00Z') }))).toBe('23514');
  });

  it('rejects duplicate customer phone within the same salon (UNIQUE)', async () => {
    const code = await pgErrorCode(
      ds.getRepository(Customer).insert({ salonId: salon.id, name: 'Dup', phone: customer.phone }),
    );
    expect(code).toBe('23505');
  });

  describe('no-overlap exclusion constraint', () => {
    it('rejects an overlapping active appointment for the same staff', async () => {
      await appointment();
      const code = await pgErrorCode(
        appointment({ startAt: at('2030-01-01T08:30:00Z'), endAt: at('2030-01-01T09:30:00Z') }),
      );
      expect(code).toBe('23P01');
    });

    it('allows back-to-back appointments (end == next start)', async () => {
      await appointment();
      await expect(
        appointment({ startAt: at('2030-01-01T09:00:00Z'), endAt: at('2030-01-01T10:00:00Z') }),
      ).resolves.toBeDefined();
    });

    it('allows the same slot for a different staff member', async () => {
      await appointment();
      await expect(appointment({ staffId: otherStaff.id })).resolves.toBeDefined();
    });

    it('ignores cancelled appointments', async () => {
      await appointment({ status: AppointmentStatus.Cancelled });
      await expect(appointment()).resolves.toBeDefined();
    });

    it('lets only one of two concurrent inserts for the same slot succeed', async () => {
      const results = await Promise.allSettled([appointment(), appointment()]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    });
  });

  it('cascades reminder jobs when an appointment is deleted', async () => {
    const { identifiers } = await appointment();
    const appointmentId = identifiers[0].id as string;
    await ds.getRepository(ReminderJob).insert({
      salonId: salon.id,
      appointmentId,
      offsetMinutes: 120,
      sendAt: at('2030-01-01T06:00:00Z'),
    });
    await ds.getRepository(Appointment).delete({ id: appointmentId });
    expect(await ds.getRepository(ReminderJob).countBy({ appointmentId })).toBe(0);
  });

  it('round-trips instants unchanged whatever the process timezone is (BS-24)', async () => {
    const originalTz = process.env.TZ;
    try {
      process.env.TZ = 'America/New_York';
      const startAt = localToUtc('2030-01-01', '15:00', 'Asia/Ho_Chi_Minh');
      const { identifiers } = await appointment({ startAt, endAt: addMinutes(startAt, 60) });
      const saved = await ds
        .getRepository(Appointment)
        .findOneByOrFail({ id: identifiers[0].id as string });
      expect(saved.startAt.toISOString()).toBe('2030-01-01T08:00:00.000Z');
      expect(utcToLocal(saved.startAt, salon.timezone).time).toBe('15:00');

      const [{ tz }] = await ds.query(`SELECT current_setting('TimeZone') AS tz`);
      expect(tz).toBe('UTC');
    } finally {
      process.env.TZ = originalTz;
    }
  });

  it('seeds the demo salon idempotently', async () => {
    const first = await seedDemoSalon(ds);
    const second = await seedDemoSalon(ds);
    expect(second.created).toBe(false);
    expect(second.salonId).toBe(first.salonId);
    const demo = await ds.getRepository(Salon).findOneByOrFail({ slug: DEMO_SALON_SLUG });
    expect(await ds.getRepository(Service).countBy({ salonId: demo.id })).toBe(3);
    expect(await ds.getRepository(Staff).countBy({ salonId: demo.id })).toBe(2);
  });
});
