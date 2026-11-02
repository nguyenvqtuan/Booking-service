import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { DEFAULT_TIMEZONE } from '@booking/shared';

@Entity('salons')
@Unique('UQ_salons_slug', ['slug'])
export class Salon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  /** Used by the public booking page /:salonSlug (BS-35). */
  @Column({ type: 'varchar', length: 80 })
  slug: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  /** IANA timezone; all display conversions and send_at calculations use it (BS-24). */
  @Column({ type: 'varchar', length: 64, default: DEFAULT_TIMEZONE })
  timezone: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
