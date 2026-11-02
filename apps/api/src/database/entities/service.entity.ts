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
  UpdateDateColumn,
} from 'typeorm';
import { Salon } from './salon.entity.js';

/** Salon service. Hidden via is_active (soft delete, BS-18). */
@Entity('services')
@Check('CHK_services_duration_positive', `"duration_min" > 0`)
@Check('CHK_services_price_non_negative', `"price" >= 0`)
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_services_salon_id')
  @Column({ name: 'salon_id', type: 'uuid' })
  salonId: string;

  @ManyToOne(() => Salon, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'salon_id', foreignKeyConstraintName: 'FK_services_salon' })
  salon: Relation<Salon>;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'duration_min', type: 'integer' })
  durationMin: number;

  /** Price in VND (integer). */
  @Column({ type: 'integer', default: 0 })
  price: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
