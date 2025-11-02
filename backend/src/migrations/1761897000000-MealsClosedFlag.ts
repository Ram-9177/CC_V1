import { MigrationInterface, QueryRunner } from "typeorm";

export class MealsClosedFlag1761897000000 implements MigrationInterface {
    name = 'MealsClosedFlag1761897000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meal_menus" ADD "closed" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meal_menus" DROP COLUMN "closed"`);
    }
}
