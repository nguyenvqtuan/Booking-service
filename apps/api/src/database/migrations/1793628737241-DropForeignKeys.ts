import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DropForeignKeys1793628737241 implements MigrationInterface {
  name = 'DropForeignKeys1793628737241';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_appointments_service"`);
    await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_appointments_staff"`);
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP CONSTRAINT "FK_appointments_customer"`,
    );
    await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_appointments_salon"`);
    await queryRunner.query(`ALTER TABLE "customers" DROP CONSTRAINT "FK_customers_salon"`);
    await queryRunner.query(
      `ALTER TABLE "message_logs" DROP CONSTRAINT "FK_message_logs_reminder_job"`,
    );
    await queryRunner.query(`ALTER TABLE "message_logs" DROP CONSTRAINT "FK_message_logs_salon"`);
    await queryRunner.query(
      `ALTER TABLE "reminder_jobs" DROP CONSTRAINT "FK_reminder_jobs_appointment"`,
    );
    await queryRunner.query(`ALTER TABLE "reminder_jobs" DROP CONSTRAINT "FK_reminder_jobs_salon"`);
    await queryRunner.query(
      `ALTER TABLE "reminder_settings" DROP CONSTRAINT "FK_reminder_settings_salon"`,
    );
    await queryRunner.query(`ALTER TABLE "services" DROP CONSTRAINT "FK_services_salon"`);
    await queryRunner.query(
      `ALTER TABLE "staff_services" DROP CONSTRAINT "FK_staff_services_service"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_services" DROP CONSTRAINT "FK_staff_services_staff"`,
    );
    await queryRunner.query(`ALTER TABLE "staff" DROP CONSTRAINT "FK_staff_salon"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_salon"`);
    await queryRunner.query(
      `ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "FK_password_reset_tokens_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_refresh_tokens_user"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_refresh_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "FK_password_reset_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_users_salon" FOREIGN KEY ("salon_id") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff" ADD CONSTRAINT "FK_staff_salon" FOREIGN KEY ("salon_id") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_services" ADD CONSTRAINT "FK_staff_services_staff" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_services" ADD CONSTRAINT "FK_staff_services_service" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" ADD CONSTRAINT "FK_services_salon" FOREIGN KEY ("salon_id") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminder_settings" ADD CONSTRAINT "FK_reminder_settings_salon" FOREIGN KEY ("salon_id") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminder_jobs" ADD CONSTRAINT "FK_reminder_jobs_salon" FOREIGN KEY ("salon_id") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminder_jobs" ADD CONSTRAINT "FK_reminder_jobs_appointment" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_logs" ADD CONSTRAINT "FK_message_logs_salon" FOREIGN KEY ("salon_id") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_logs" ADD CONSTRAINT "FK_message_logs_reminder_job" FOREIGN KEY ("reminder_job_id") REFERENCES "reminder_jobs"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD CONSTRAINT "FK_customers_salon" FOREIGN KEY ("salon_id") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "FK_appointments_salon" FOREIGN KEY ("salon_id") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "FK_appointments_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "FK_appointments_staff" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "FK_appointments_service" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
