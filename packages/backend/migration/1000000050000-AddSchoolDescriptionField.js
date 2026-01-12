export class AddSchoolDescriptionField1000000050000 {
	name = 'AddSchoolDescriptionField1000000050000'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "schools" ADD "description" varchar(512)`);
		await queryRunner.query(`COMMENT ON COLUMN "schools"."description" IS 'Description of the school.'`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN "description"`);
	}
}
