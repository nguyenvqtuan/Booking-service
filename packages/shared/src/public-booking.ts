import { z } from 'zod';
import { phoneSchema } from './customers.js';
import { localeSchema } from './locale.js';

/** Slugs that would clash with routes of the web app; salons cannot use them. */
export const RESERVED_SLUGS = [
  'login',
  'register',
  'forgot-password',
  'reset-password',
  'appointments',
  'services',
  'staff',
  'customers',
  'settings',
  'reports',
  'public',
  'api',
  'assets',
  'appointment',
];

export const publicBookingSchema = z.object({
  serviceId: z.uuid(),
  staffId: z.uuid(),
  startAt: z.iso.datetime({ offset: true }),
  name: z.string().trim().min(1).max(150),
  phone: phoneSchema,
  locale: localeSchema.optional(),
});
export type PublicBookingInput = z.input<typeof publicBookingSchema>;
export type PublicBookingParsed = z.output<typeof publicBookingSchema>;

export const publicStaffQuerySchema = z.object({ serviceId: z.uuid().optional() });

export interface PublicSalonDto {
  name: string;
  slug: string;
  timezone: string;
}

export interface PublicServiceDto {
  id: string;
  name: string;
  durationMin: number;
  price: number;
}

export interface PublicStaffDto {
  id: string;
  name: string;
}

/** Confirmation shown to an anonymous visitor: never contains customer data. */
export interface PublicBookingResult {
  salonName: string;
  serviceName: string;
  staffName: string;
  startAt: string;
  endAt: string;
}
