import { MigrationInterface, QueryRunner } from "typeorm";

export class EnforceUpperBedLabelTrigger1761990400000 implements MigrationInterface {
  name = 'EnforceUpperBedLabelTrigger1761990400000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create or replace the function that uppercases the bedLabel field
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enforce_upper_bed_label() RETURNS trigger AS $$
      BEGIN
        IF NEW."bedLabel" IS NOT NULL THEN
          NEW."bedLabel" := UPPER(NEW."bedLabel");
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Recreate the trigger to ensure it exists and uses the latest function
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_users_bed_label_upper ON users;`);
    await queryRunner.query(`
      CREATE TRIGGER trg_users_bed_label_upper
      BEFORE INSERT OR UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION enforce_upper_bed_label();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_users_bed_label_upper ON users;
    `);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS enforce_upper_bed_label();
    `);
  }
}
