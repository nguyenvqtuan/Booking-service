import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** Single-use link token sent in reminders (BS-37). Only the SHA-256 hash is stored. */
@Entity('appointment_action_tokens')
@Unique('UQ_appointment_action_tokens_hash', ['tokenHash'])
export class AppointmentActionToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Implicit relation to salons.id (no FK, BS-70). */
  @Index('IDX_appointment_action_tokens_salon_id')
  @Column({ name: 'salon_id', type: 'uuid' })
  salonId: string;

  /** Implicit relation to appointments.id (no FK, BS-70). */
  @Index('IDX_appointment_action_tokens_appointment_id')
  @Column({ name: 'appointment_id', type: 'uuid' })
  appointmentId: string;

  @Column({ name: 'token_hash', type: 'char', length: 64 })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
