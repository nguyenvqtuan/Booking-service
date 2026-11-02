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
} from 'typeorm';
import { MessageChannel, MessageLogStatus } from '@booking/shared';
import { ReminderJob } from './reminder-job.entity.js';
import { Salon } from './salon.entity.js';
import { sqlIn } from './sql-helpers.js';

/** One row per send attempt (BS-32). */
@Entity('message_logs')
@Index('IDX_message_logs_salon_created', ['salonId', 'createdAt'])
@Check('CHK_message_logs_status', `"status" IN ${sqlIn(Object.values(MessageLogStatus))}`)
@Check('CHK_message_logs_channel', `"channel" IN ${sqlIn(Object.values(MessageChannel))}`)
export class MessageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'salon_id', type: 'uuid' })
  salonId: string;

  @ManyToOne(() => Salon, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'salon_id', foreignKeyConstraintName: 'FK_message_logs_salon' })
  salon: Relation<Salon>;

  @Index('IDX_message_logs_reminder_job_id')
  @Column({ name: 'reminder_job_id', type: 'uuid', nullable: true })
  reminderJobId: string | null;

  @ManyToOne(() => ReminderJob, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reminder_job_id', foreignKeyConstraintName: 'FK_message_logs_reminder_job' })
  reminderJob: Relation<ReminderJob> | null;

  @Column({ type: 'varchar', length: 10 })
  channel: MessageChannel;

  /** Provider name, e.g. 'zalo', 'esms', 'fake'. */
  @Column({ type: 'varchar', length: 30 })
  provider: string;

  @Column({ name: 'to_phone', type: 'varchar', length: 20 })
  toPhone: string;

  @Column({ name: 'provider_msg_id', type: 'varchar', length: 100, nullable: true })
  providerMsgId: string | null;

  @Column({ type: 'varchar', length: 30 })
  status: MessageLogStatus;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
