import { MigrationInterface, QueryRunner } from "typeorm";

export class RoomsPhase91761987600000 implements MigrationInterface {
    name = 'RoomsPhase91761987600000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "rooms" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "block" character varying NOT NULL, "number" character varying NOT NULL, "floor" character varying, "capacity" integer NOT NULL DEFAULT '4', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0368a2d7c215f2de0f3be3db77b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_rooms_block" ON "rooms" ("block")`);
        await queryRunner.query(`CREATE INDEX "idx_rooms_number" ON "rooms" ("number")`);
        await queryRunner.query(`ALTER TABLE "users" ADD "roomId" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "bedLabel" character varying(4)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "bedLabel"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "roomId"`);
        await queryRunner.query(`DROP INDEX "public"."idx_rooms_number"`);
        await queryRunner.query(`DROP INDEX "public"."idx_rooms_block"`);
        await queryRunner.query(`DROP TABLE "rooms"`);
    }
}
