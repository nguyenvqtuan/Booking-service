import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { MessageChannel, ReminderJobStatus } from '@booking/shared';
import { Appointment } from './appointment.entity.js';
import { Salon } from './salon.entity.js';
import { sqlIn } from './sql-helpers.js';

/** One reminder point of an appointment (BS-26). The cron scans by (status, send_at) (BS-27). */
@Entity('reminder_jobs')
@Unique('UQ_reminder_jobs_appointment_offset', ['appointmentId', 'offsetMinutes'])
@Index('IDX_reminder_jobs_status_send_at', ['status', 'sendAt'])
@Check('CHK_reminder_jobs_status', `"status" IN ${sqlIn(Object.values(ReminderJobStatus))}`)
@Check('CHK_reminder_jobs_channel', `"channel" IN ${sqlIn(Object.values(MessageChannel))}`)
export class ReminderJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_reminder_jobs_salon_id')
  @Column({ name: 'salon_id', type: 'uuid' })
  salonId: string;

  @ManyToOne(() => Salon, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'salon_id', foreignKeyConstraintName: 'FK_reminder_jobs_salon' })
  salon: Relation<Salon>;

  @Column({ name: 'appointment_id', type: 'uuid' })
  appointmentId: string;

  @ManyToOne(() => Appointment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appointment_id', foreignKeyConstraintName: 'FK_reminder_jobs_appointment' })
  appointment: Relation<Appointment>;

  /** Minutes before the appointment, e.g. 1440 (24h), 120 (2h). */
  @Column({ name: 'offset_minutes', type: 'integer' })
  offsetMinutes: number;

  @Column({ name: 'send_at', type: 'timestamptz' })
  sendAt: Date;

  /** Preferred channel; SMS fallback is handled by the worker (BS-31). */
  @Column({ type: 'varchar', length: 10, default: MessageChannel.Zns })
  channel: MessageChannel;

  @Column({ type: 'varchar', length: 20, default: ReminderJobStatus.Pending })
  status: ReminderJobStatus;

  @Column({ name: 'attempt_count', type: 'integer', default: 0 })
  attemptCount: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
