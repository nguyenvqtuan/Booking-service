import type { DataSource } from 'typeorm';
import { DEFAULT_REMINDER_OFFSETS_MIN, DEFAULT_TIMEZONE, type WorkingHours } from '@booking/shared';
import {
  Customer,
  ReminderSetting,
  Salon,
  Service,
  Staff,
  StaffService,
} from '../entities/index.js';

export const DEMO_SALON_SLUG = 'demo-salon';

const weekdayShifts: WorkingHours = {
  mon: [
    { start: '09:00', end: '12:00' },
    { start: '13:30', end: '20:00' },
  ],
  tue: [{ start: '09:00', end: '20:00' }],
  wed: [{ start: '09:00', end: '20:00' }],
  thu: [{ start: '09:00', end: '20:00' }],
  fri: [{ start: '09:00', end: '20:00' }],
  sat: [{ start: '08:00', end: '21:00' }],
  sun: [],
};

/**
 * Creates a demo salon with services, staff, customers and reminder settings.
 * Idempotent: does nothing when the slug already exists.
 */
export async function seedDemoSalon(
  ds: DataSource,
): Promise<{ created: boolean; salonId: string }> {
  return ds.transaction(async (em) => {
    const existing = await em.findOne(Salon, { where: { slug: DEMO_SALON_SLUG } });
    if (existing) return { created: false, salonId: existing.id };

    const salon = await em.save(
      em.create(Salon, {
        name: 'Tiệm Mẫu',
        slug: DEMO_SALON_SLUG,
        phone: '+84901234567',
        address: '1 Lê Lợi, Quận 1, TP.HCM',
        timezone: DEFAULT_TIMEZONE,
      }),
    );

    await em.save(
      em.create(ReminderSetting, {
        salonId: salon.id,
        offsets: DEFAULT_REMINDER_OFFSETS_MIN,
        fallbackEnabled: true,
      }),
    );

    const [cut, wash, nail] = await em.save(
      [
        { name: 'Cắt tóc', durationMin: 30, price: 100000 },
        { name: 'Gội đầu dưỡng sinh', durationMin: 45, price: 150000 },
        { name: 'Làm móng', durationMin: 60, price: 200000 },
      ].map((s) => em.create(Service, { ...s, salonId: salon.id })),
    );

    const [an, binh] = await em.save(
      [
        { name: 'Nguyễn An', phone: '+84911111111', workingHours: weekdayShifts },
        { name: 'Trần Bình', phone: '+84922222222', workingHours: { ...weekdayShifts, mon: [] } },
      ].map((s) => em.create(Staff, { ...s, salonId: salon.id })),
    );

    await em.save([
      em.create(StaffService, { staffId: an.id, serviceId: cut.id }),
      em.create(StaffService, { staffId: an.id, serviceId: wash.id }),
      em.create(StaffService, { staffId: binh.id, serviceId: nail.id }),
    ]);

    await em.save(
      [
        { name: 'Lê Chi', phone: '+84933333333' },
        { name: 'Phạm Dũng', phone: '+84944444444', noShowCount: 2 },
      ].map((c) => em.create(Customer, { ...c, salonId: salon.id })),
    );

    return { created: true, salonId: salon.id };
  });
}
