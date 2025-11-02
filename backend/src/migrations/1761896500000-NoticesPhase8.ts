import { MigrationInterface, QueryRunner } from "typeorm";

export class NoticesPhase81761896500000 implements MigrationInterface {
    name = 'NoticesPhase81761896500000'

    public async up(queryRunner: QueryRunner): Promise<void> {
           await queryRunner.query(`CREATE TYPE "public"."notices_priority_enum" AS ENUM('LOW', 'NORMAL', 'HIGH')`);
           await queryRunner.query(`CREATE TABLE "notices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" text NOT NULL, "content" text NOT NULL, "priority" "public"."notices_priority_enum" NOT NULL DEFAULT 'NORMAL', "roles" text array, "hostelIds" text array, "blockIds" text array, "attachments" json, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "expiresAt" TIMESTAMP, "authorId" uuid NOT NULL, CONSTRAINT "PK_notices_id" PRIMARY KEY ("id"))`);
           await queryRunner.query(`CREATE INDEX "IDX_notices_expiresAt" ON "notices" ("expiresAt")`);
           await queryRunner.query(`ALTER TABLE "notices" ADD CONSTRAINT "FK_notices_authorId_users" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
           await queryRunner.query(`ALTER TABLE "notices" DROP CONSTRAINT "FK_notices_authorId_users"`);
           await queryRunner.query(`DROP INDEX "public"."IDX_notices_expiresAt"`);
           await queryRunner.query(`DROP TABLE "notices"`);
           await queryRunner.query(`DROP TYPE "public"."notices_priority_enum"`);
    }
}
