import { MigrationInterface, QueryRunner } from "typeorm";

export class RoomsUniqueBlockNumber1761990300000 implements MigrationInterface {
  name = 'RoomsUniqueBlockNumber1761990300000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uniq_rooms_block_number" ON "rooms" ("block", "number");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uniq_rooms_block_number";`);
  }
}
