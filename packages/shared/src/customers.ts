import { z } from 'zod';
import type { AppointmentStatus } from './enums.js';
import { localeSchema, type Locale } from './locale.js';
import { normalizePhone } from './phone.js';

/** Phone field that accepts any common format and outputs E.164. */
export const phoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .transform((value, ctx) => {
    const e164 = normalizePhone(value);
    if (!e164) {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid phone number',
        params: { reason: 'phone' },
      });
      return z.NEVER;
    }
    return e164;
  });

export const customerInputSchema = z.object({
  name: z.string().trim().min(1).max(150),
  phone: phoneSchema,
  note: z
    .string()
    .trim()
    .max(1000)
    .transform((v) => v || null)
    .nullable()
    .optional(),
  locale: localeSchema.optional(),
});
export type CustomerInput = z.input<typeof customerInputSchema>;
export type CustomerInputParsed = z.output<typeof customerInputSchema>;

export const customerUpdateSchema = customerInputSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
export type CustomerUpdate = z.input<typeof customerUpdateSchema>;
export type CustomerUpdateParsed = z.output<typeof customerUpdateSchema>;

export const customerListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type CustomerListQuery = z.input<typeof customerListQuerySchema>;

/** Customers with this many no-shows get a warning badge. */
export const NO_SHOW_WARNING_THRESHOLD = 2;

export interface CustomerDto {
  id: string;
  name: string;
  phone: string;
  note: string | null;
  locale: Locale;
  noShowCount: number;
}

export interface CustomerHistoryItem {
  id: string;
  startAt: string;
  status: AppointmentStatus;
  serviceName: string;
  staffName: string;
}

export interface CustomerDetailDto extends CustomerDto {
  history: CustomerHistoryItem[];
}

export interface Page<T> {
  items: T[];
  total: number;
}
