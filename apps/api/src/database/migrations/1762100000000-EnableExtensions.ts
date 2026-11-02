import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sample migration (BS-12) and prerequisite for BS-13:
 * btree_gist is required by the no-overlap exclusion constraint on appointments.
 */
export class EnableExtensions1762100000000 implements MigrationInterface {
  name = 'EnableExtensions1762100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP EXTENSION IF EXISTS btree_gist`);
  }
}
