import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { WorkingHours } from '@booking/shared';

@Entity('staff')
export class Staff {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Implicit relation to salons.id (no FK, BS-70). */
  @Index('IDX_staff_salon_id')
  @Column({ name: 'salon_id', type: 'uuid' })
  salonId: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  /** Working hours per weekday, multiple shifts per day, in salon local time. See WorkingHours. */
  @Column({ name: 'working_hours', type: 'jsonb', default: {} })
  workingHours: WorkingHours;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
