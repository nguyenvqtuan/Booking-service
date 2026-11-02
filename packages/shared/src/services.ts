import { z } from 'zod';

export const SERVICE_MAX_DURATION_MIN = 600;

export const serviceInputSchema = z.object({
  name: z.string().trim().min(1).max(150),
  durationMin: z.coerce.number().int().positive().max(SERVICE_MAX_DURATION_MIN),
  price: z.coerce.number().int().min(0).max(1_000_000_000),
});
export type ServiceInput = z.infer<typeof serviceInputSchema>;

export const serviceUpdateSchema = serviceInputSchema
  .extend({ isActive: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
export type ServiceUpdate = z.infer<typeof serviceUpdateSchema>;

export interface ServiceDto {
  id: string;
  name: string;
  durationMin: number;
  price: number;
  isActive: boolean;
}
