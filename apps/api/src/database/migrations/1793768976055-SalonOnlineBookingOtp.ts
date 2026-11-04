import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SalonOnlineBookingOtp1793768976055 implements MigrationInterface {
  name = 'SalonOnlineBookingOtp1793768976055';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "salons" ADD "online_booking_otp" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "salons" DROP COLUMN "online_booking_otp"`);
  }
}
