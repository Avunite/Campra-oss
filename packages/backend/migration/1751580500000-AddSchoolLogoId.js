export class AddSchoolLogoId1751580500000 {
    constructor() {
        this.name = 'AddSchoolLogoId1751580500000';
    }

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "schools" ADD "logoId" character varying(32)`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN "logoId"`);
    }
}
