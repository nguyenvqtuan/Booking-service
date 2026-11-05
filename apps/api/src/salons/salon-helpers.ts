import type { EntityManager } from 'typeorm';
import { RESERVED_SLUGS, type SalonSummary } from '@booking/shared';
import { slugify } from '../common/slugify.js';
import { Salon, UserSalon } from '../database/entities/index.js';

/** "Tiệm A" -> "tiem-a", then "tiem-a-2", "tiem-a-3"... if taken or reserved. */
export async function uniqueSalonSlug(name: string, em: EntityManager): Promise<string> {
  const base = slugify(name) || 'salon';
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    if (RESERVED_SLUGS.includes(candidate)) continue;
    if (!(await em.exists(Salon, { where: { slug: candidate } }))) return candidate;
  }
}

/** The user's salons through the implicit user_salons relation, ordered by name. */
export async function listUserSalons(em: EntityManager, userId: string): Promise<SalonSummary[]> {
  return em
    .createQueryBuilder(UserSalon, 'us')
    .innerJoin(Salon, 's', 's.id = us.salon_id')
    .select(['s.id AS id', 's.name AS name', 's.slug AS slug', 'us.role AS role'])
    .where('us.user_id = :userId', { userId })
    .orderBy('s.name', 'ASC')
    .getRawMany<SalonSummary>();
}
