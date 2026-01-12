export class AddIffyApiUrlToMeta1751575200000 {
    async up(queryRunner) {
        // Add missing iffyApiUrl column to meta table
        await queryRunner.query(`ALTER TABLE "meta" ADD "iffyApiUrl" character varying(512)`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "iffyApiUrl"`);
    }
}
