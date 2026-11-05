import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UserSalons1793770411034 implements MigrationInterface {
  name = 'UserSalons1793770411034';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_salons" ("user_id" uuid NOT NULL, "salon_id" uuid NOT NULL, "role" character varying(20) NOT NULL DEFAULT 'owner', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_user_salons_role" CHECK ("role" IN ('owner', 'manager')), CONSTRAINT "PK_c3f8e0fa66a2777b988cf96cb67" PRIMARY KEY ("user_id", "salon_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_salons_salon_id" ON "user_salons"  ("salon_id") `,
    );
    await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD "salon_id" uuid`);
    // Every existing user owns the salon they signed up with.
    await queryRunner.query(
      `INSERT INTO "user_salons" ("user_id", "salon_id", "role") SELECT "id", "salon_id", 'owner' FROM "users"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN "salon_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_user_salons_salon_id"`);
    await queryRunner.query(`DROP TABLE "user_salons"`);
  }
}
