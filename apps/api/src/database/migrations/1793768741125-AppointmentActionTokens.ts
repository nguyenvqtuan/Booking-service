import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AppointmentActionTokens1793768741125 implements MigrationInterface {
  name = 'AppointmentActionTokens1793768741125';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "appointment_action_tokens" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "salon_id" uuid NOT NULL, "appointment_id" uuid NOT NULL, "token_hash" character(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_appointment_action_tokens_hash" UNIQUE ("token_hash"), CONSTRAINT "PK_d633b8df693b64ea62930487ebb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_appointment_action_tokens_salon_id" ON "appointment_action_tokens"  ("salon_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_appointment_action_tokens_appointment_id" ON "appointment_action_tokens"  ("appointment_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_appointment_action_tokens_appointment_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_appointment_action_tokens_salon_id"`);
    await queryRunner.query(`DROP TABLE "appointment_action_tokens"`);
  }
}
