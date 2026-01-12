export class AddIffyConfidenceThresholdToMeta1751575300000 {
    async up(queryRunner) {
        // Add missing iffyConfidenceThreshold column to meta table
        await queryRunner.query(`ALTER TABLE "meta" ADD "iffyConfidenceThreshold" varchar(16) DEFAULT 'medium'`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "iffyConfidenceThreshold"`);
    }
}
