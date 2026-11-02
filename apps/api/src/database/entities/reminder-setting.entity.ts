import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { Salon } from './salon.entity.js';

/** Per-salon reminder settings (1:1 with salon). */
@Entity('reminder_settings')
export class ReminderSetting {
  @PrimaryColumn({ name: 'salon_id', type: 'uuid' })
  salonId: string;

  @OneToOne(() => Salon, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'salon_id', foreignKeyConstraintName: 'FK_reminder_settings_salon' })
  salon: Relation<Salon>;

  /** Offsets in minutes before the appointment, default [1440, 120]. */
  @Column({ type: 'jsonb', default: [1440, 120] })
  offsets: number[];

  /** Send SMS when ZNS cannot reach the customer (BS-31). */
  @Column({ name: 'fallback_enabled', type: 'boolean', default: true })
  fallbackEnabled: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
