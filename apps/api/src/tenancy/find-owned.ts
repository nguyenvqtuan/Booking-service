import { NotFoundException } from '@nestjs/common';
import type { FindOptionsWhere, ObjectLiteral, Repository } from 'typeorm';

/** Entities that belong to a salon. */
export interface SalonOwned extends ObjectLiteral {
  id: string;
  salonId: string;
}

/**
 * Loads an entity by id *and* salon id. Records of other salons are reported as 404
 * (not 403) so callers cannot probe which ids exist.
 */
export async function findOwnedOrFail<T extends SalonOwned>(
  repo: Repository<T>,
  id: string,
  salonId: string,
): Promise<T> {
  const entity = await repo.findOne({ where: { id, salonId } as FindOptionsWhere<T> });
  if (!entity) throw new NotFoundException(`${repo.metadata.name} not found`);
  return entity;
}
