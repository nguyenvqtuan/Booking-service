import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';

/**
 * Deletes a salon and everything that belongs to it, children first, in one transaction.
 * Needed because the schema has no foreign keys / ON DELETE CASCADE (BS-70).
 */
@Injectable()
export class SalonDeletionService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  delete(salonId: string): Promise<void> {
    return this.dataSource.transaction((em) => deleteSalonData(em, salonId));
  }
}

/** Usable from tests/scripts with a plain EntityManager. */
export async function deleteSalonData(em: EntityManager, salonId: string): Promise<void> {
  const bySalon = (table: string) =>
    em.query(`DELETE FROM "${table}" WHERE salon_id = $1`, [salonId]);
  const userIds = `SELECT id FROM users WHERE salon_id = $1`;

  await bySalon('message_logs');
  await bySalon('reminder_jobs');
  await bySalon('appointment_action_tokens');
  await bySalon('appointments');
  await em.query(
    `DELETE FROM staff_services WHERE staff_id IN (SELECT id FROM staff WHERE salon_id = $1)
        OR service_id IN (SELECT id FROM services WHERE salon_id = $1)`,
    [salonId],
  );
  await bySalon('staff');
  await bySalon('services');
  await bySalon('customers');
  await bySalon('reminder_settings');
  await em.query(`DELETE FROM refresh_tokens WHERE user_id IN (${userIds})`, [salonId]);
  await em.query(`DELETE FROM password_reset_tokens WHERE user_id IN (${userIds})`, [salonId]);
  await bySalon('users');
  await em.query(`DELETE FROM salons WHERE id = $1`, [salonId]);
}
