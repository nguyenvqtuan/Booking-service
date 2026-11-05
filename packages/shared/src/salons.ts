import { z } from 'zod';

export enum SalonRole {
  Owner = 'owner',
  Manager = 'manager',
}

/** A salon/branch the signed-in user belongs to (BS-42). */
export interface SalonSummary {
  id: string;
  name: string;
  slug: string;
  role: SalonRole;
}

export const createSalonSchema = z.object({ name: z.string().trim().min(2).max(150) });
export type CreateSalonInput = z.infer<typeof createSalonSchema>;

export const switchSalonSchema = z.object({ salonId: z.uuid() });
export type SwitchSalonInput = z.infer<typeof switchSalonSchema>;
