import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomerSearch1793628140825 implements MigrationInterface {
  name = 'CustomerSearch1793628140825';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Accent-insensitive customer name search ("nguyen" finds "Nguyễn").
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);
    await queryRunner.query(
      `ALTER TABLE "customers" ADD CONSTRAINT "CHK_customers_phone_e164" CHECK ("phone" ~ '^\\+[1-9][0-9]{7,14}$')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "customers" DROP CONSTRAINT "CHK_customers_phone_e164"`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS unaccent`);
  }
}
