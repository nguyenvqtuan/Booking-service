import { Entity, Index, PrimaryColumn } from 'typeorm';

/** Which services a staff member can perform (BS-19). */
@Entity('staff_services')
export class StaffService {
  /** Implicit relation to staff.id (no FK, BS-70). */
  @PrimaryColumn({ name: 'staff_id', type: 'uuid' })
  staffId: string;

  /** Implicit relation to services.id (no FK, BS-70). */
  @Index('IDX_staff_services_service_id')
  @PrimaryColumn({ name: 'service_id', type: 'uuid' })
  serviceId: string;
}
