import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Salon service. Hidden via is_active (soft delete, BS-18). */
@Entity('services')
@Check('CHK_services_duration_positive', `"duration_min" > 0`)
@Check('CHK_services_price_non_negative', `"price" >= 0`)
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Implicit relation to salons.id (no FK, BS-70). */
  @Index('IDX_services_salon_id')
  @Column({ name: 'salon_id', type: 'uuid' })
  salonId: string;

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
