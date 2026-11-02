import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import {
  addMinutes,
  AppointmentStatus,
  localToUtc,
  MessageChannel,
  MessageLogStatus,
  utcToLocal,
} from '@booking/shared';
import {
  Appointment,
  Customer,
  MessageLog,
  ReminderJob,
  Salon,
  Service,
  Staff,
  StaffService,
} from '../src/database/entities/index.js';
import {
  findOrphans,
  IMPLICIT_RELATIONS,
  NON_RELATION_ID_COLUMNS,
} from '../src/database/implicit-relations.js';
import { DEMO_SALON_SLUG, seedDemoSalon } from '../src/database/seeds/demo-salon.seed.js';
import { deleteSalonData } from '../src/salons/salon-deletion.service.js';
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
    if (ds) await deleteSalonData(ds.manager, salon.id);
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

  it('has no foreign keys: relations are implicit through *_id columns (BS-70)', async () => {
    const [{ count }] = await ds.query(
      `SELECT count(*)::int AS count FROM pg_constraint c
       JOIN pg_namespace n ON n.oid = c.connamespace
       WHERE c.contype = 'f' AND n.nspname = 'public'`,
    );
    expect(count).toBe(0);
  });

  it('registers every *_id column as an implicit relation', async () => {
    const rows: { table_name: string; column_name: string }[] = await ds.query(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND column_name LIKE '%\\_id' ESCAPE '\\'`,
    );
    const registered = new Set(IMPLICIT_RELATIONS.map((r) => `${r.table}.${r.column}`));
    const missing = rows
      .map((r) => `${r.table_name}.${r.column_name}`)
      .filter((key) => !registered.has(key) && !NON_RELATION_ID_COLUMNS.includes(key));
    expect(missing).toEqual([]);
  });

  it('deletes a whole salon and leaves no orphaned rows', async () => {
    const other = await ds
      .getRepository(Salon)
      .save({ name: 'Doomed', slug: `doomed-${randomUUID()}` });
    const st = await ds.getRepository(Staff).save({ salonId: other.id, name: 'S' });
    const sv = await ds
      .getRepository(Service)
      .save({ salonId: other.id, name: 'Sv', durationMin: 30 });
    await ds.getRepository(StaffService).insert({ staffId: st.id, serviceId: sv.id });
    const cu = await ds
      .getRepository(Customer)
      .save({ salonId: other.id, name: 'C', phone: '+84900000999' });
    const { identifiers } = await ds.getRepository(Appointment).insert({
      salonId: other.id,
      staffId: st.id,
      serviceId: sv.id,
      customerId: cu.id,
      startAt: at('2030-01-01T08:00:00Z'),
      endAt: at('2030-01-01T08:30:00Z'),
    });
    const { identifiers: jobs } = await ds.getRepository(ReminderJob).insert({
      salonId: other.id,
      appointmentId: identifiers[0].id as string,
      offsetMinutes: 120,
      sendAt: at('2030-01-01T06:00:00Z'),
    });
    await ds.getRepository(MessageLog).insert({
      salonId: other.id,
      reminderJobId: jobs[0].id as string,
      channel: MessageChannel.Zns,
      provider: 'fake',
      toPhone: cu.phone,
      status: MessageLogStatus.Success,
    });

    await deleteSalonData(ds.manager, other.id);

    for (const r of IMPLICIT_RELATIONS.filter((x) => x.column === 'salon_id')) {
      const [{ count }] = await ds.query(
        `SELECT count(*)::int AS count FROM "${r.table}" WHERE salon_id = $1`,
        [other.id],
      );
      expect(count, r.table).toBe(0);
    }
    expect(await findOrphans(ds)).toEqual([]);
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
