import { MigrationInterface, QueryRunner } from "typeorm";

export class RoomsUniqueBedConstraint1761990000000 implements MigrationInterface {
    name = 'RoomsUniqueBedConstraint1761990000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Ensure unique bed per room when both values are present (PostgreSQL partial index)
        // Note: our users table uses camelCase columns (roomId, bedLabel), so we must quote identifiers
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uniq_users_room_bed" ON "users" ("roomId", "bedLabel") WHERE "roomId" IS NOT NULL AND "bedLabel" IS NOT NULL;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "uniq_users_room_bed";`);
    }
}
