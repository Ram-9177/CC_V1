import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1761891540079 implements MigrationInterface {
    name = 'InitSchema1761891540079'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('STUDENT', 'GATEMAN', 'WARDEN', 'WARDEN_HEAD', 'CHEF', 'SUPER_ADMIN')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "hallticket" character varying NOT NULL, "password" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'STUDENT', "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "phoneNumber" character varying, "email" character varying, "roomNumber" character varying, "hostelBlock" character varying, "profilePhoto" character varying, "isActive" boolean NOT NULL DEFAULT true, "lastLoginAt" TIMESTAMP, "fcmToken" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_b110ce2c29f63a79d50e62d7a0d" UNIQUE ("hallticket"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b110ce2c29f63a79d50e62d7a0" ON "users" ("hallticket") `);
        await queryRunner.query(`CREATE TABLE "notification_audit" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "recipient" character varying, "topic" character varying, "payload" json, "status" character varying(32) NOT NULL DEFAULT 'pending', "error" text, "attempts" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_da1f9b7a6c8d8d06c21bb4aede9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."gate_passes_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'EXPIRED', 'REVOKED')`);
        await queryRunner.query(`CREATE TABLE "gate_passes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "passNumber" character varying NOT NULL, "reason" text NOT NULL, "destination" character varying NOT NULL, "fromDate" TIMESTAMP NOT NULL, "toDate" TIMESTAMP NOT NULL, "status" "public"."gate_passes_status_enum" NOT NULL DEFAULT 'PENDING', "approvedAt" TIMESTAMP, "rejectedReason" text, "qrCode" text, "adWatchedAt" TIMESTAMP, "lastActivityAt" TIMESTAMP, "autoRevokedAt" TIMESTAMP, "isEmergency" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "studentId" uuid, "approvedById" uuid, CONSTRAINT "UQ_606ad931f1dd25c62a1c3408536" UNIQUE ("passNumber"), CONSTRAINT "PK_79b23816ff12bcbf579124b45ca" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_606ad931f1dd25c62a1c340853" ON "gate_passes" ("passNumber") `);
        await queryRunner.query(`CREATE TYPE "public"."gate_scans_scantype_enum" AS ENUM('ENTRY', 'EXIT')`);
        await queryRunner.query(`CREATE TABLE "gate_scans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "scanType" "public"."gate_scans_scantype_enum" NOT NULL, "scannedAt" TIMESTAMP NOT NULL DEFAULT now(), "location" character varying, "notes" text, "gatePassId" uuid, "scannedById" uuid, CONSTRAINT "PK_7b61e666a093b424147ceb0120f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "attendance_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "recordedAt" TIMESTAMP NOT NULL DEFAULT now(), "present" boolean NOT NULL DEFAULT true, "sessionId" uuid, "studentId" uuid, CONSTRAINT "PK_946920332f5bc9efad3f3023b96" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "attendance_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "startsAt" TIMESTAMP NOT NULL, "endsAt" TIMESTAMP NOT NULL, "qrCode" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "createdById" uuid, CONSTRAINT "PK_84d565d9e484e2bcdaf4a9e1890" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "gate_passes" ADD CONSTRAINT "FK_0148cca1e1c9f21f96979b97ebe" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "gate_passes" ADD CONSTRAINT "FK_a0a9a9479e86e7a171261837aa3" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "gate_scans" ADD CONSTRAINT "FK_7bca853eb88a49a262108f11937" FOREIGN KEY ("gatePassId") REFERENCES "gate_passes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "gate_scans" ADD CONSTRAINT "FK_6c2dcc62a7d8dbd38655fe1d668" FOREIGN KEY ("scannedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "attendance_records" ADD CONSTRAINT "FK_73dc742eac42ee289715b6d2593" FOREIGN KEY ("sessionId") REFERENCES "attendance_sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "attendance_records" ADD CONSTRAINT "FK_21f6cf258d12a2432bd2a8f798d" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "attendance_sessions" ADD CONSTRAINT "FK_552af4e2a67d864c5210bfcc92e" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "attendance_sessions" DROP CONSTRAINT "FK_552af4e2a67d864c5210bfcc92e"`);
        await queryRunner.query(`ALTER TABLE "attendance_records" DROP CONSTRAINT "FK_21f6cf258d12a2432bd2a8f798d"`);
        await queryRunner.query(`ALTER TABLE "attendance_records" DROP CONSTRAINT "FK_73dc742eac42ee289715b6d2593"`);
        await queryRunner.query(`ALTER TABLE "gate_scans" DROP CONSTRAINT "FK_6c2dcc62a7d8dbd38655fe1d668"`);
        await queryRunner.query(`ALTER TABLE "gate_scans" DROP CONSTRAINT "FK_7bca853eb88a49a262108f11937"`);
        await queryRunner.query(`ALTER TABLE "gate_passes" DROP CONSTRAINT "FK_a0a9a9479e86e7a171261837aa3"`);
        await queryRunner.query(`ALTER TABLE "gate_passes" DROP CONSTRAINT "FK_0148cca1e1c9f21f96979b97ebe"`);
        await queryRunner.query(`DROP TABLE "attendance_sessions"`);
        await queryRunner.query(`DROP TABLE "attendance_records"`);
        await queryRunner.query(`DROP TABLE "gate_scans"`);
        await queryRunner.query(`DROP TYPE "public"."gate_scans_scantype_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_606ad931f1dd25c62a1c340853"`);
        await queryRunner.query(`DROP TABLE "gate_passes"`);
        await queryRunner.query(`DROP TYPE "public"."gate_passes_status_enum"`);
        await queryRunner.query(`DROP TABLE "notification_audit"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b110ce2c29f63a79d50e62d7a0"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    }

}
