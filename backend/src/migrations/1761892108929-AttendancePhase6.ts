import { MigrationInterface, QueryRunner } from "typeorm";

export class AttendancePhase61761892108929 implements MigrationInterface {
    name = 'AttendancePhase61761892108929'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "attendance_records" DROP COLUMN "recordedAt"`);
        await queryRunner.query(`ALTER TABLE "attendance_records" DROP COLUMN "present"`);
        await queryRunner.query(`ALTER TABLE "attendance_sessions" DROP COLUMN "startsAt"`);
        await queryRunner.query(`ALTER TABLE "attendance_sessions" DROP COLUMN "endsAt"`);
        await queryRunner.query(`ALTER TABLE "attendance_records" ADD "markedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "attendance_records" ADD "status" character varying(16) NOT NULL DEFAULT 'PRESENT'`);
        await queryRunner.query(`ALTER TABLE "attendance_records" ADD "method" character varying(10)`);
        await queryRunner.query(`ALTER TABLE "attendance_records" ADD "notes" text`);
        await queryRunner.query(`ALTER TABLE "attendance_records" ADD "markedById" uuid`);
        await queryRunner.query(`ALTER TABLE "attendance_sessions" ADD "sessionType" character varying`);
        await queryRunner.query(`ALTER TABLE "attendance_sessions" ADD "scheduledAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "attendance_sessions" ADD "startedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "attendance_sessions" ADD "endedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "attendance_sessions" ADD "status" character varying(16) NOT NULL DEFAULT 'SCHEDULED'`);
        await queryRunner.query(`ALTER TABLE "attendance_sessions" ADD "mode" character varying(8) NOT NULL DEFAULT 'QR'`);
        await queryRunner.query(`ALTER TABLE "attendance_sessions" ADD "totalExpected" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "attendance_sessions" ADD "totalPresent" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "attendance_sessions" ADD "totalAbsent" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "attendance_sessions" ADD "metadata" json`);
        await queryRunner.query(`ALTER TABLE "attendance_records" ADD CONSTRAINT "FK_81808fd5719a7f5cb9cd4c770fc" FOREIGN KEY ("markedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "attendance_records" DROP CONSTRAINT "FK_81808fd5719a7f5cb9cd4c770fc"`);
        await queryRunner.query(`ALTER TABLE "attendance_sessions" DROP COLUMN "metadata"`);
        await queryRunner.query(`ALTER TABLE "attendance_sessions" DROP COLUMN "totalAbsent"`);
        await queryRunner.query(`ALTER TABLE "attendance_sessions" DROP COLUMN "totalPresent"`);
        await queryRunner.query(`ALTER TABLE "attendance_sessions" DROP COLUMN "totalExpected"`);
        await queryRunner.query(`ALTER TABLE "attendance_sessions" DROP COLUMN "mode"`);
        await queryRunner.query(`ALTER TABLE "attendance_sessions" DROP COLUMN "status"`);
        await queryRunner.query(`ALTER TABLE "attendance_sessions" DROP COLUMN "endedAt"`);
        await queryRunner.query(`ALTER TABLE "attendance_sessions" DROP COLUMN "startedAt"`);
        await queryRunner.query(`ALTER TABLE "attendance_sessions" DROP COLUMN "scheduledAt"`);
        await queryRunner.query(`ALTER TABLE "attendance_sessions" DROP COLUMN "sessionType"`);
        await queryRunner.query(`ALTER TABLE "attendance_records" DROP COLUMN "markedById"`);
        await queryRunner.query(`ALTER TABLE "attendance_records" DROP COLUMN "notes"`);
        await queryRunner.query(`ALTER TABLE "attendance_records" DROP COLUMN "method"`);
        await queryRunner.query(`ALTER TABLE "attendance_records" DROP COLUMN "status"`);
        await queryRunner.query(`ALTER TABLE "attendance_records" DROP COLUMN "markedAt"`);
        await queryRunner.query(`ALTER TABLE "attendance_sessions" ADD "endsAt" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "attendance_sessions" ADD "startsAt" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "attendance_records" ADD "present" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "attendance_records" ADD "recordedAt" TIMESTAMP NOT NULL DEFAULT now()`);
    }

}
