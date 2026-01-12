export class AddIffyScanToNote1751575107000 {
    async up(queryRunner) {
        // Add columns to note table
        await queryRunner.query(`ALTER TABLE "note" ADD "iffyScanResult" jsonb`);
        await queryRunner.query(`ALTER TABLE "note" ADD "iffyScanUrl" character varying(512)`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "note" DROP COLUMN "iffyScanUrl"`);
        await queryRunner.query(`ALTER TABLE "note" DROP COLUMN "iffyScanResult"`);
    }
}
