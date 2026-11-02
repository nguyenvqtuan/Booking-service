import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Exclusion,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ACTIVE_APPOINTMENT_STATUSES, AppointmentSource, AppointmentStatus } from '@booking/shared';
import { sqlIn } from './sql-helpers.js';

/**
 * Appointment. Times are stored in UTC (timestamptz).
 * Overlapping bookings for the same staff member are rejected by a DB exclusion
 * constraint (BS-22, BS-63), which is race-safe for every create/update path.
 */
@Entity('appointments')
@Index('IDX_appointments_salon_start', ['salonId', 'startAt'])
@Index('IDX_appointments_staff_start', ['staffId', 'startAt'])
@Check('CHK_appointments_time_range', `"end_at" > "start_at"`)
@Check('CHK_appointments_status', `"status" IN ${sqlIn(Object.values(AppointmentStatus))}`)
@Check('CHK_appointments_source', `"source" IN ${sqlIn(Object.values(AppointmentSource))}`)
@Exclusion(
  'EXCL_appointments_staff_no_overlap',
  `USING gist ("staff_id" WITH =, tstzrange("start_at", "end_at") WITH &&) WHERE ("status" IN ${sqlIn(ACTIVE_APPOINTMENT_STATUSES)})`,
)
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Implicit relation to salons.id (no FK, BS-70). */
  @Column({ name: 'salon_id', type: 'uuid' })
  salonId: string;

  /** Implicit relation to customers.id (no FK, BS-70). */
  @Index('IDX_appointments_customer_id')
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  /** Implicit relation to staff.id (no FK, BS-70). */
  @Column({ name: 'staff_id', type: 'uuid' })
  staffId: string;

  /** Implicit relation to services.id (no FK, BS-70). */
  @Index('IDX_appointments_service_id')
  @Column({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @Column({ name: 'start_at', type: 'timestamptz' })
  startAt: Date;

  /** = start_at + service duration at booking time. */
  @Column({ name: 'end_at', type: 'timestamptz' })
  endAt: Date;

  @Column({ type: 'varchar', length: 20, default: AppointmentStatus.Booked })
  status: AppointmentStatus;

  @Column({ type: 'varchar', length: 20, default: AppointmentSource.Admin })
  source: AppointmentSource;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
