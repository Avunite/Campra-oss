export class AddIsTeacherField1751580400000 {
	name = 'AddIsTeacherField1751580400000';

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user" ADD "isTeacher" boolean NOT NULL DEFAULT false`);
		await queryRunner.query(`COMMENT ON COLUMN "user"."isTeacher" IS 'Whether the User is a teacher.'`);
		await queryRunner.query(`CREATE INDEX "IDX_user_isTeacher" ON "user" ("isTeacher")`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX "IDX_user_isTeacher"`);
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isTeacher"`);
	}
}