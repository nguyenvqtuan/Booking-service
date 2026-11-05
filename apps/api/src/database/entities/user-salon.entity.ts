import { Check, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { SalonRole } from '@booking/shared';
import { sqlIn } from './sql-helpers.js';

/** Which salons/branches a user can access, and with which role (BS-42). */
@Entity('user_salons')
@Check('CHK_user_salons_role', `"role" IN ${sqlIn(Object.values(SalonRole))}`)
export class UserSalon {
  /** Implicit relation to users.id (no FK, BS-70). */
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Implicit relation to salons.id (no FK, BS-70). */
  @Index('IDX_user_salons_salon_id')
  @PrimaryColumn({ name: 'salon_id', type: 'uuid' })
  salonId: string;

  @Column({ type: 'varchar', length: 20, default: SalonRole.Owner })
  role: SalonRole;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
