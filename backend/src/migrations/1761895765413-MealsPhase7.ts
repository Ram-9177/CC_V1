import { MigrationInterface, QueryRunner } from "typeorm";

export class MealsPhase71761895765413 implements MigrationInterface {
    name = 'MealsPhase71761895765413'

    public async up(queryRunner: QueryRunner): Promise<void> {
           await queryRunner.query(`CREATE TYPE "public"."meal_menu_mealtype_enum" AS ENUM('BREAKFAST', 'LUNCH', 'DINNER', 'SNACKS')`);
           await queryRunner.query(`CREATE TABLE "meal_menus" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" date NOT NULL, "mealType" "public"."meal_menu_mealtype_enum" NOT NULL, "items" json NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdById" uuid NOT NULL, CONSTRAINT "PK_meal_menus_id" PRIMARY KEY ("id"))`);
           await queryRunner.query(`CREATE INDEX "IDX_meal_menus_date" ON "meal_menus" ("date")`);
           await queryRunner.query(`CREATE TYPE "public"."meal_intent_intent_enum" AS ENUM('YES', 'NO', 'SAME', 'NO_RESPONSE')`);
           await queryRunner.query(`CREATE TABLE "meal_intents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "intent" "public"."meal_intent_intent_enum" NOT NULL, "respondedAt" TIMESTAMP NOT NULL DEFAULT now(), "autoExcluded" boolean NOT NULL DEFAULT false, "actualAttended" boolean, "menuId" uuid NOT NULL, "studentId" uuid NOT NULL, CONSTRAINT "PK_meal_intents_id" PRIMARY KEY ("id"))`);
           await queryRunner.query(`ALTER TABLE "meal_menus" ADD CONSTRAINT "FK_meal_menus_createdById_users" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
           await queryRunner.query(`ALTER TABLE "meal_intents" ADD CONSTRAINT "FK_meal_intents_menuId" FOREIGN KEY ("menuId") REFERENCES "meal_menus"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
           await queryRunner.query(`ALTER TABLE "meal_intents" ADD CONSTRAINT "FK_meal_intents_studentId" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
           await queryRunner.query(`ALTER TABLE "meal_intents" DROP CONSTRAINT "FK_meal_intents_studentId"`);
           await queryRunner.query(`ALTER TABLE "meal_intents" DROP CONSTRAINT "FK_meal_intents_menuId"`);
           await queryRunner.query(`ALTER TABLE "meal_menus" DROP CONSTRAINT "FK_meal_menus_createdById_users"`);
           await queryRunner.query(`DROP TABLE "meal_intents"`);
           await queryRunner.query(`DROP TYPE "public"."meal_intent_intent_enum"`);
           await queryRunner.query(`DROP INDEX "public"."IDX_meal_menus_date"`);
           await queryRunner.query(`DROP TABLE "meal_menus"`);
           await queryRunner.query(`DROP TYPE "public"."meal_menu_mealtype_enum"`);
    }

}
