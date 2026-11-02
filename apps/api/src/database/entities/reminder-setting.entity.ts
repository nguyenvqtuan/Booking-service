import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Per-salon reminder settings (1:1 with salon). */
@Entity('reminder_settings')
export class ReminderSetting {
  /** Implicit relation to salons.id (no FK, BS-70). */
  @PrimaryColumn({ name: 'salon_id', type: 'uuid' })
  salonId: string;

  /** Offsets in minutes before the appointment, default [1440, 120]. */
  @Column({ type: 'jsonb', default: [1440, 120] })
  offsets: number[];

  /** Send SMS when ZNS cannot reach the customer (BS-31). */
  @Column({ name: 'fallback_enabled', type: 'boolean', default: true })
  fallbackEnabled: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
