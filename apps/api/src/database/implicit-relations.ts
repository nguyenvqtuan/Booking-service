import type { DataSource } from 'typeorm';

/**
 * The schema has no foreign keys (BS-70): relations are implicit through *_id columns and
 * integrity is enforced by the services. This registry is the single list of those relations,
 * used to delete a salon in a safe order and to detect orphaned rows.
 */
export interface ImplicitRelation {
  table: string;
  column: string;
  parentTable: string;
  /** A NULL value is allowed and is not an orphan. */
  nullable?: boolean;
}

export const IMPLICIT_RELATIONS: ImplicitRelation[] = [
  { table: 'users', column: 'salon_id', parentTable: 'salons' },
  { table: 'user_salons', column: 'user_id', parentTable: 'users' },
  { table: 'user_salons', column: 'salon_id', parentTable: 'salons' },
  { table: 'refresh_tokens', column: 'user_id', parentTable: 'users' },
  { table: 'refresh_tokens', column: 'salon_id', parentTable: 'salons', nullable: true },
  { table: 'password_reset_tokens', column: 'user_id', parentTable: 'users' },
  { table: 'staff', column: 'salon_id', parentTable: 'salons' },
  { table: 'services', column: 'salon_id', parentTable: 'salons' },
  { table: 'staff_services', column: 'staff_id', parentTable: 'staff' },
  { table: 'staff_services', column: 'service_id', parentTable: 'services' },
  { table: 'customers', column: 'salon_id', parentTable: 'salons' },
  { table: 'appointments', column: 'salon_id', parentTable: 'salons' },
  { table: 'appointments', column: 'customer_id', parentTable: 'customers' },
  { table: 'appointments', column: 'staff_id', parentTable: 'staff' },
  { table: 'appointments', column: 'service_id', parentTable: 'services' },
  { table: 'reminder_jobs', column: 'salon_id', parentTable: 'salons' },
  { table: 'reminder_jobs', column: 'appointment_id', parentTable: 'appointments' },
  { table: 'message_logs', column: 'salon_id', parentTable: 'salons' },
  {
    table: 'message_logs',
    column: 'reminder_job_id',
    parentTable: 'reminder_jobs',
    nullable: true,
  },
  { table: 'reminder_settings', column: 'salon_id', parentTable: 'salons' },
  { table: 'appointment_action_tokens', column: 'salon_id', parentTable: 'salons' },
  { table: 'appointment_action_tokens', column: 'appointment_id', parentTable: 'appointments' },
];

/** *_id columns that are identifiers, not relations. */
export const NON_RELATION_ID_COLUMNS = ['refresh_tokens.family_id', 'message_logs.provider_msg_id'];

export interface OrphanReport {
  relation: string;
  count: number;
}

/** Counts rows whose implicit parent no longer exists. Empty result = consistent database. */
export async function findOrphans(ds: DataSource): Promise<OrphanReport[]> {
  const reports: OrphanReport[] = [];
  for (const r of IMPLICIT_RELATIONS) {
    const [{ count }] = await ds.query(
      `SELECT count(*)::int AS count FROM "${r.table}" c
       WHERE c."${r.column}" IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM "${r.parentTable}" p WHERE p.id = c."${r.column}")`,
    );
    if (count > 0) reports.push({ relation: `${r.table}.${r.column} -> ${r.parentTable}`, count });
  }
  return reports;
}
