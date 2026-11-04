import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ProviderTokens1793630136367 implements MigrationInterface {
  name = 'ProviderTokens1793630136367';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "provider_tokens" ("provider" character varying(30) NOT NULL, "access_token" text NOT NULL, "refresh_token" text NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_692706039311974e84c959751ae" PRIMARY KEY ("provider"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "provider_tokens"`);
  }
}
