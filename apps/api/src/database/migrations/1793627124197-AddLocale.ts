import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLocale1793627124197 implements MigrationInterface {
  name = 'AddLocale1793627124197';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customers" ADD "locale" character varying(5) NOT NULL DEFAULT 'vi'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "locale" character varying(5) NOT NULL DEFAULT 'vi'`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD CONSTRAINT "CHK_customers_locale" CHECK ("locale" IN ('vi', 'en'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "CHK_users_locale" CHECK ("locale" IN ('vi', 'en'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "CHK_users_locale"`);
    await queryRunner.query(`ALTER TABLE "customers" DROP CONSTRAINT "CHK_customers_locale"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "locale"`);
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN "locale"`);
  }
}
