import { randomUUID } from 'node:crypto';
import { ErrorCode, localToUtc } from '@booking/shared';
import request from 'supertest';
import { Appointment, Customer, Salon } from '../src/database/entities/index.js';
import { OwnerFactory, type TestOwner } from './utils/owners.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

const VN = 'Asia/Ho_Chi_Minh';

describe('public online booking (e2e)', () => {
  let t: TestApp;
  let owners: OwnerFactory;
  let a: TestOwner;
  let slug: string;
  let ids: { staffId: string; serviceId: string };
  let otherStaffId: string;
  let day = 5;

  const http = () => request(t.app.getHttpServer());
  /** Next Monday-to-Sunday free date in the far future; staff works every day. */
  const nextDate = () => {
    day++;
    return `2034-06-${String(day).padStart(2, '0')}`;
  };
  const book = (body: Record<string, unknown>) =>
    http()
      .post(`/public/${slug}/appointments`)
      .send({ ...ids, name: 'Lan', phone: '0912345678', ...body });
  const slot = (date: string, time: string) => localToUtc(date, time, VN).toISOString();

  beforeAll(async () => {
    t = await createTestApp();
    owners = new OwnerFactory(t);
    a = await owners.create();
    slug = (await t.dataSource.getRepository(Salon).findOneByOrFail({ id: a.salonId })).slug;
    const svc = (
      await a.post('/services').send({ name: 'Cắt tóc', durationMin: 30, price: 100000 })
    ).body;
    const hidden = (await a.post('/services').send({ name: 'Ẩn', durationMin: 30, price: 0 })).body;
    await a.patch(`/services/${hidden.id}`).send({ isActive: false }).expect(200);
    const shift = [{ start: '09:00', end: '12:00' }];
    const week = {
      mon: shift,
      tue: shift,
      wed: shift,
      thu: shift,
      fri: shift,
      sat: shift,
      sun: shift,
    };
    const staff = (
      await a.post('/staff').send({ name: 'An', workingHours: week, serviceIds: [svc.id] })
    ).body;
    otherStaffId = (await a.post('/staff').send({ name: 'Không làm', workingHours: week })).body.id;
    ids = { staffId: staff.id, serviceId: svc.id };
  });

  afterAll(async () => {
    await owners.cleanup();
    await t.app.close();
  });

  it('exposes salon, active services, eligible staff and slots without login', async () => {
    const salon = await http().get(`/public/${slug}`).expect(200);
    expect(salon.body).toEqual({ name: 'Test Salon', slug, timezone: VN, otpRequired: false });

    const services = await http().get(`/public/${slug}/services`).expect(200);
    expect(services.body.map((s: { name: string }) => s.name)).toEqual(['Cắt tóc']);
    expect(Object.keys(services.body[0]).sort()).toEqual(['durationMin', 'id', 'name', 'price']);

    const staff = await http()
      .get(`/public/${slug}/staff`)
      .query({ serviceId: ids.serviceId })
      .expect(200);
    expect(staff.body).toEqual([{ id: ids.staffId, name: 'An' }]);

    const slots = await http()
      .get(`/public/${slug}/slots`)
      .query({ ...ids, date: nextDate() })
      .expect(200);
    expect(slots.body[0].time).toBe('09:00');
  });

  it('returns 404 for an unknown slug on every endpoint', async () => {
    const unknown = `no-such-${randomUUID()}`;
    await http().get(`/public/${unknown}`).expect(404);
    await http().get(`/public/${unknown}/services`).expect(404);
    await http()
      .post(`/public/${unknown}/appointments`)
      .send({ ...ids, name: 'x', phone: '0912345678', startAt: slot('2034-06-01', '09:00') })
      .expect(404);
  });

  it('books without login: creates the customer and an online appointment shown to the salon', async () => {
    const date = nextDate();
    const res = await book({
      startAt: slot(date, '09:30'),
      phone: '090 111 2222',
      name: 'Khách Mới',
      locale: 'en',
    }).expect(201);
    expect(res.body).toEqual({
      salonName: 'Test Salon',
      serviceName: 'Cắt tóc',
      staffName: 'An',
      startAt: slot(date, '09:30'),
      endAt: slot(date, '10:00'),
    });
    expect(JSON.stringify(res.body)).not.toContain('0901112222');

    const list = await a
      .get('/appointments')
      .query({ from: slot(date, '00:00'), to: slot(date, '23:59') })
      .expect(200);
    expect(list.body[0]).toMatchObject({
      source: 'online',
      customerName: 'Khách Mới',
      customerPhone: '+84901112222',
    });
    const customer = await t.dataSource
      .getRepository(Customer)
      .findOneByOrFail({ salonId: a.salonId, phone: '+84901112222' });
    expect(customer.locale).toBe('en');
  });

  it('reuses an existing customer by phone and does not overwrite their name', async () => {
    const { body } = await a
      .post('/customers')
      .send({ name: 'Tên Gốc', phone: '0922000111' })
      .expect(201);
    await book({
      startAt: slot(nextDate(), '09:00'),
      phone: '+84 922 000 111',
      name: 'Tên Giả',
    }).expect(201);
    const customer = await t.dataSource.getRepository(Customer).findOneByOrFail({ id: body.id });
    expect(customer.name).toBe('Tên Gốc');
    expect(await t.dataSource.getRepository(Appointment).countBy({ customerId: body.id })).toBe(1);
  });

  it('schedules reminders for online bookings too', async () => {
    const date = nextDate();
    await book({ startAt: slot(date, '10:00'), phone: '0933000222' }).expect(201);
    const list = await a
      .get('/appointments')
      .query({ from: slot(date, '00:00'), to: slot(date, '23:59') })
      .expect(200);
    const detail = await a.get(`/appointments/${list.body[0].id}`).expect(200);
    expect(detail.body.reminders).toHaveLength(2);
  });

  it.each([
    ['outside working hours', '20:00'],
    ['after the last valid start', '11:45'],
    ['not aligned to a slot', '09:07'],
  ])('refuses a time %s', async (_label, time) => {
    const res = await book({ startAt: slot(nextDate(), time) }).expect(409);
    expect(res.body.code).toBe(ErrorCode.SlotUnavailable);
  });

  it('refuses past times and a staff member who does not offer the service', async () => {
    await book({ startAt: slot('2020-01-06', '09:00') }).expect(409);
    await book({ startAt: slot(nextDate(), '09:00'), staffId: otherStaffId }).expect(409);
  });

  it('lets only one of two concurrent visitors take a slot, with no duplicate customer', async () => {
    const date = nextDate();
    const results = await Promise.all([
      book({ startAt: slot(date, '09:00'), phone: '0944000333', name: 'A' }),
      book({ startAt: slot(date, '09:00'), phone: '0944000333', name: 'B' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(
      await t.dataSource
        .getRepository(Customer)
        .countBy({ salonId: a.salonId, phone: '+84944000333' }),
    ).toBe(1);
  });

  it('validates input', async () => {
    const res = await book({ startAt: slot(nextDate(), '09:00'), phone: '123', name: '' }).expect(
      400,
    );
    expect(Object.keys(res.body.fields).sort()).toEqual(['name', 'phone']);
  });

  it('never gives salons a slug that clashes with an app route', async () => {
    const res = await http()
      .post('/auth/register')
      .send({
        salonName: 'Login',
        fullName: 'Owner',
        email: `o-${randomUUID()}@example.com`,
        password: 'correct-horse-1',
      })
      .expect(201);
    expect(res.body.user.salonSlug).toBe('login-2');
    const { deleteSalonData } = await import('../src/salons/salon-deletion.service.js');
    await deleteSalonData(t.dataSource.manager, res.body.user.salonId);
  });
});
