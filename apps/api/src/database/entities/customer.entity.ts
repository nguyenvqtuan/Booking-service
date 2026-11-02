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

@Entity('customers')
@Unique('UQ_customers_salon_phone', ['salonId', 'phone'])
@Check('CHK_customers_phone_e164', `"phone" ~ '^\\+[1-9][0-9]{7,14}$'`)
@Check('CHK_customers_locale', `"locale" IN ${sqlIn(SUPPORTED_LOCALES)}`)
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_customers_salon_id')
  @Column({ name: 'salon_id', type: 'uuid' })
  salonId: string;

  @ManyToOne(() => Salon, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'salon_id', foreignKeyConstraintName: 'FK_customers_salon' })
  salon: Relation<Salon>;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  /** E.164, e.g. +84901234567 (normalized in BS-20). */
  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'no_show_count', type: 'integer', default: 0 })
  noShowCount: number;

  /** UI language (users) / reminder template language (customers). */
  @Column({ type: 'varchar', length: 5, default: DEFAULT_LOCALE })
  locale: Locale;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
