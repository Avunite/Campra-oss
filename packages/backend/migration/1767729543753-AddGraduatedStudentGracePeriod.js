export default class AddGraduatedStudentGracePeriod1767729543753 {
	name = 'AddGraduatedStudentGracePeriod1767729543753';

	async up(queryRunner) {
		// Add grace period and data export fields to graduated_students table
		await queryRunner.query(`
			ALTER TABLE "graduated_students"
			ADD COLUMN IF NOT EXISTS "gracePeriodEndsAt" timestamp with time zone
		`);

		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_graduated_students_gracePeriodEndsAt"
			ON "graduated_students"("gracePeriodEndsAt")
		`);

		await queryRunner.query(`
			ALTER TABLE "graduated_students"
			ADD COLUMN IF NOT EXISTS "dataExportRequestedAt" timestamp with time zone
		`);

		await queryRunner.query(`
			ALTER TABLE "graduated_students"
			ADD COLUMN IF NOT EXISTS "dataExportUrl" varchar(512)
		`);

		await queryRunner.query(`
			ALTER TABLE "graduated_students"
			ADD COLUMN IF NOT EXISTS "notifiedAboutDeletion" boolean DEFAULT false
		`);

		await queryRunner.query(`
			ALTER TABLE "graduated_students"
			ADD COLUMN IF NOT EXISTS "notifiedAt" timestamp with time zone
		`);

		// Set default 30-day grace period for existing graduated students without one
		await queryRunner.query(`
			UPDATE "graduated_students"
			SET "gracePeriodEndsAt" = "graduationDate" + INTERVAL '30 days'
			WHERE "gracePeriodEndsAt" IS NULL
		`);
	}

	async down(queryRunner) {
		// Remove indexes
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_graduated_students_gracePeriodEndsAt"`);

		// Remove columns
		await queryRunner.query(`ALTER TABLE "graduated_students" DROP COLUMN IF EXISTS "notifiedAt"`);
		await queryRunner.query(`ALTER TABLE "graduated_students" DROP COLUMN IF EXISTS "notifiedAboutDeletion"`);
		await queryRunner.query(`ALTER TABLE "graduated_students" DROP COLUMN IF EXISTS "dataExportUrl"`);
		await queryRunner.query(`ALTER TABLE "graduated_students" DROP COLUMN IF EXISTS "dataExportRequestedAt"`);
		await queryRunner.query(`ALTER TABLE "graduated_students" DROP COLUMN IF EXISTS "gracePeriodEndsAt"`);
	}
}
