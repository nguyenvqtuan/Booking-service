import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1793625852128 implements MigrationInterface {
  name = 'InitialSchema1793625852128';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "salons" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(150) NOT NULL, "slug" character varying(80) NOT NULL, "phone" character varying(20), "address" text, "timezone" character varying(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_salons_slug" UNIQUE ("slug"), CONSTRAINT "PK_4cbe0adde860abd3b68b196a0b2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "customers" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "salon_id" uuid NOT NULL, "name" character varying(150) NOT NULL, "phone" character varying(20) NOT NULL, "note" text, "no_show_count" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_customers_salon_phone" UNIQUE ("salon_id", "phone"), CONSTRAINT "PK_133ec679a801fab5e070f73d3ea" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_customers_salon_id" ON "customers"  ("salon_id") `);
    await queryRunner.query(
      `CREATE TABLE "services" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "salon_id" uuid NOT NULL, "name" character varying(150) NOT NULL, "duration_min" integer NOT NULL, "price" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_services_price_non_negative" CHECK ("price" >= 0), CONSTRAINT "CHK_services_duration_positive" CHECK ("duration_min" > 0), CONSTRAINT "PK_ba2d347a3168a296416c6c5ccb2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_services_salon_id" ON "services"  ("salon_id") `);
    await queryRunner.query(
      `CREATE TABLE "staff" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "salon_id" uuid NOT NULL, "name" character varying(150) NOT NULL, "phone" character varying(20), "working_hours" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e4ee98bb552756c180aec1e854a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_staff_salon_id" ON "staff"  ("salon_id") `);
    await queryRunner.query(
      `CREATE TABLE "appointments" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "salon_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "staff_id" uuid NOT NULL, "service_id" uuid NOT NULL, "start_at" TIMESTAMP WITH TIME ZONE NOT NULL, "end_at" TIMESTAMP WITH TIME ZONE NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'booked', "source" character varying(20) NOT NULL DEFAULT 'admin', "note" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_appointments_source" CHECK ("source" IN ('admin', 'online')), CONSTRAINT "CHK_appointments_status" CHECK ("status" IN ('booked', 'confirmed', 'cancelled', 'completed', 'no_show')), CONSTRAINT "CHK_appointments_time_range" CHECK ("end_at" > "start_at"), CONSTRAINT "EXCL_appointments_staff_no_overlap" EXCLUDE USING gist ("staff_id" WITH =, tstzrange("start_at", "end_at") WITH &&) WHERE ("status" IN ('booked', 'confirmed')), CONSTRAINT "PK_4a437a9a27e948726b8bb3e36ad" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_appointments_customer_id" ON "appointments"  ("customer_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_appointments_service_id" ON "appointments"  ("service_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_appointments_staff_start" ON "appointments"  ("staff_id", "start_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_appointments_salon_start" ON "appointments"  ("salon_id", "start_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "reminder_jobs" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "salon_id" uuid NOT NULL, "appointment_id" uuid NOT NULL, "offset_minutes" integer NOT NULL, "send_at" TIMESTAMP WITH TIME ZONE NOT NULL, "channel" character varying(10) NOT NULL DEFAULT 'zns', "status" character varying(20) NOT NULL DEFAULT 'pending', "attempt_count" integer NOT NULL DEFAULT '0', "last_error" text, "sent_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_reminder_jobs_appointment_offset" UNIQUE ("appointment_id", "offset_minutes"), CONSTRAINT "CHK_reminder_jobs_channel" CHECK ("channel" IN ('zns', 'sms')), CONSTRAINT "CHK_reminder_jobs_status" CHECK ("status" IN ('pending', 'queued', 'sending', 'retrying', 'sent', 'failed', 'cancelled')), CONSTRAINT "PK_31693695f053eb55efa0b7fa8d6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reminder_jobs_salon_id" ON "reminder_jobs"  ("salon_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reminder_jobs_status_send_at" ON "reminder_jobs"  ("status", "send_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "message_logs" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "salon_id" uuid NOT NULL, "reminder_job_id" uuid, "channel" character varying(10) NOT NULL, "provider" character varying(30) NOT NULL, "to_phone" character varying(20) NOT NULL, "provider_msg_id" character varying(100), "status" character varying(30) NOT NULL, "error" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_message_logs_channel" CHECK ("channel" IN ('zns', 'sms')), CONSTRAINT "CHK_message_logs_status" CHECK ("status" IN ('success', 'recipient_unreachable', 'transient', 'permanent')), CONSTRAINT "PK_f0aae0d876a96fa1da0a1b97444" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_message_logs_reminder_job_id" ON "message_logs"  ("reminder_job_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_message_logs_salon_created" ON "message_logs"  ("salon_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "reminder_settings" ("salon_id" uuid NOT NULL, "offsets" jsonb NOT NULL DEFAULT '[1440, 120]'::jsonb, "fallback_enabled" boolean NOT NULL DEFAULT true, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a582e376dc7a7a502ce5c8f4b75" PRIMARY KEY ("salon_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "staff_services" ("staff_id" uuid NOT NULL, "service_id" uuid NOT NULL, CONSTRAINT "PK_e24f1ebc4df9eb7a2462ad1a261" PRIMARY KEY ("staff_id", "service_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_staff_services_service_id" ON "staff_services"  ("service_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "salon_id" uuid NOT NULL, "email" character varying(255) NOT NULL, "password_hash" character varying(255) NOT NULL, "full_name" character varying(150) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_users_email" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_users_salon_id" ON "users"  ("salon_id") `);
    await queryRunner.query(
      `ALTER TABLE "customers" ADD CONSTRAINT "FK_customers_salon" FOREIGN KEY ("salon_id") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" ADD CONSTRAINT "FK_services_salon" FOREIGN KEY ("salon_id") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff" ADD CONSTRAINT "FK_staff_salon" FOREIGN KEY ("salon_id") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "FK_appointments_salon" FOREIGN KEY ("salon_id") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "FK_appointments_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "FK_appointments_staff" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "FK_appointments_service" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
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
      `ALTER TABLE "reminder_settings" ADD CONSTRAINT "FK_reminder_settings_salon" FOREIGN KEY ("salon_id") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_services" ADD CONSTRAINT "FK_staff_services_staff" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_services" ADD CONSTRAINT "FK_staff_services_service" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_users_salon" FOREIGN KEY ("salon_id") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_salon"`);
    await queryRunner.query(
      `ALTER TABLE "staff_services" DROP CONSTRAINT "FK_staff_services_service"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_services" DROP CONSTRAINT "FK_staff_services_staff"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminder_settings" DROP CONSTRAINT "FK_reminder_settings_salon"`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_logs" DROP CONSTRAINT "FK_message_logs_reminder_job"`,
    );
    await queryRunner.query(`ALTER TABLE "message_logs" DROP CONSTRAINT "FK_message_logs_salon"`);
    await queryRunner.query(
      `ALTER TABLE "reminder_jobs" DROP CONSTRAINT "FK_reminder_jobs_appointment"`,
    );
    await queryRunner.query(`ALTER TABLE "reminder_jobs" DROP CONSTRAINT "FK_reminder_jobs_salon"`);
    await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_appointments_service"`);
    await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_appointments_staff"`);
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP CONSTRAINT "FK_appointments_customer"`,
    );
    await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_appointments_salon"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP CONSTRAINT "FK_staff_salon"`);
    await queryRunner.query(`ALTER TABLE "services" DROP CONSTRAINT "FK_services_salon"`);
    await queryRunner.query(`ALTER TABLE "customers" DROP CONSTRAINT "FK_customers_salon"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_users_salon_id"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_staff_services_service_id"`);
    await queryRunner.query(`DROP TABLE "staff_services"`);
    await queryRunner.query(`DROP TABLE "reminder_settings"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_message_logs_salon_created"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_message_logs_reminder_job_id"`);
    await queryRunner.query(`DROP TABLE "message_logs"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_reminder_jobs_status_send_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_reminder_jobs_salon_id"`);
    await queryRunner.query(`DROP TABLE "reminder_jobs"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_appointments_salon_start"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_appointments_staff_start"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_appointments_service_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_appointments_customer_id"`);
    await queryRunner.query(`DROP TABLE "appointments"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_staff_salon_id"`);
    await queryRunner.query(`DROP TABLE "staff"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_services_salon_id"`);
    await queryRunner.query(`DROP TABLE "services"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_customers_salon_id"`);
    await queryRunner.query(`DROP TABLE "customers"`);
    await queryRunner.query(`DROP TABLE "salons"`);
  }
}
