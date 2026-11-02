import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { Service } from './service.entity.js';
import { Staff } from './staff.entity.js';

/** Which services a staff member can perform (BS-19). */
@Entity('staff_services')
export class StaffService {
  @PrimaryColumn({ name: 'staff_id', type: 'uuid' })
  staffId: string;

  @Index('IDX_staff_services_service_id')
  @PrimaryColumn({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @ManyToOne(() => Staff, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staff_id', foreignKeyConstraintName: 'FK_staff_services_staff' })
  staff: Relation<Staff>;

  @ManyToOne(() => Service, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id', foreignKeyConstraintName: 'FK_staff_services_service' })
  service: Relation<Service>;
}
