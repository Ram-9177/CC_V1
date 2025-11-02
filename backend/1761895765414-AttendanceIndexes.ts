import { MigrationInterface, QueryRunner } from "typeorm";

export class AttendanceIndexes1761895765414 implements MigrationInterface {
    name = 'AttendanceIndexes1761895765414'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Sessions indexes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_attendance_sessions_status" ON "attendance_sessions" ("status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_attendance_sessions_scheduled_at" ON "attendance_sessions" ("scheduledAt")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_attendance_sessions_title" ON "attendance_sessions" ("title")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_attendance_sessions_created_at" ON "attendance_sessions" ("createdAt")`);

        // Records indexes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_attendance_records_session_id" ON "attendance_records" ("sessionId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_attendance_records_student_id" ON "attendance_records" ("studentId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_attendance_records_marked_at" ON "attendance_records" ("markedAt")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_attendance_records_status" ON "attendance_records" ("status")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop in reverse order
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_attendance_records_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_attendance_records_marked_at"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_attendance_records_student_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_attendance_records_session_id"`);

        await queryRunner.query(`DROP INDEX IF EXISTS "idx_attendance_sessions_created_at"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_attendance_sessions_title"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_attendance_sessions_scheduled_at"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_attendance_sessions_status"`);
    }
}
