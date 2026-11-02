import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration mẫu (BS-12) và cũng là tiền đề cho BS-13:
 * btree_gist cần cho exclusion constraint chống trùng giờ trên appointments.
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
