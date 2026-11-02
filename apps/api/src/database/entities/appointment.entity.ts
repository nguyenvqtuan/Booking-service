import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Exclusion,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { ACTIVE_APPOINTMENT_STATUSES, AppointmentSource, AppointmentStatus } from '@booking/shared';
import { Customer } from './customer.entity.js';
import { Salon } from './salon.entity.js';
import { Service } from './service.entity.js';
import { Staff } from './staff.entity.js';
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

  @Column({ name: 'salon_id', type: 'uuid' })
  salonId: string;

  @ManyToOne(() => Salon, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'salon_id', foreignKeyConstraintName: 'FK_appointments_salon' })
  salon: Relation<Salon>;

  @Index('IDX_appointments_customer_id')
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @ManyToOne(() => Customer, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'customer_id', foreignKeyConstraintName: 'FK_appointments_customer' })
  customer: Relation<Customer>;

  @Column({ name: 'staff_id', type: 'uuid' })
  staffId: string;

  @ManyToOne(() => Staff, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'staff_id', foreignKeyConstraintName: 'FK_appointments_staff' })
  staff: Relation<Staff>;

  @Index('IDX_appointments_service_id')
  @Column({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  /**
   * NO ACTION (checked at statement end, unlike RESTRICT): a service with appointments cannot be
   * deleted on its own, yet deleting the whole salon still cascades cleanly (BS-18).
   */
  @ManyToOne(() => Service, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'service_id', foreignKeyConstraintName: 'FK_appointments_service' })
  service: Relation<Service>;

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
