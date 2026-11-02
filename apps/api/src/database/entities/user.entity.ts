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
import { DEFAULT_LOCALE, type Locale, SUPPORTED_LOCALES } from '@booking/shared';
import { Salon } from './salon.entity.js';
import { sqlIn } from './sql-helpers.js';

/** Salon owner / login user. MVP: each user belongs to one salon (multi-branch in BS-42). */
@Entity('users')
@Unique('UQ_users_email', ['email'])
@Check('CHK_users_locale', `"locale" IN ${sqlIn(SUPPORTED_LOCALES)}`)
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_users_salon_id')
  @Column({ name: 'salon_id', type: 'uuid' })
  salonId: string;

  @ManyToOne(() => Salon, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'salon_id', foreignKeyConstraintName: 'FK_users_salon' })
  salon: Relation<Salon>;

  /** Always stored in lowercase. */
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ name: 'full_name', type: 'varchar', length: 150 })
  fullName: string;

  /** UI language (users) / reminder template language (customers). */
  @Column({ type: 'varchar', length: 5, default: DEFAULT_LOCALE })
  locale: Locale;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
