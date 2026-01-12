export class FixIffyConfidenceThresholdType1736607600000 {
    async up(queryRunner) {
        // Fix iffyConfidenceThreshold column type from real to varchar(16)
        // Check if the column exists before trying to modify it
        const columnExists = await queryRunner.hasColumn('meta', 'iffyConfidenceThreshold');
        if (columnExists) {
            await queryRunner.query(`ALTER TABLE "meta" ALTER COLUMN "iffyConfidenceThreshold" TYPE varchar(16) USING 'medium'`);
            await queryRunner.query(`ALTER TABLE "meta" ALTER COLUMN "iffyConfidenceThreshold" SET DEFAULT 'medium'`);
        }
    }

    async down(queryRunner) {
        // Revert back to real type (though this would lose data)
        // Check if the column exists before trying to modify it
        const columnExists = await queryRunner.hasColumn('meta', 'iffyConfidenceThreshold');
        if (columnExists) {
            await queryRunner.query(`ALTER TABLE "meta" ALTER COLUMN "iffyConfidenceThreshold" TYPE real USING 0.5`);
            await queryRunner.query(`ALTER TABLE "meta" ALTER COLUMN "iffyConfidenceThreshold" SET DEFAULT 0.5`);
        }
    }
}
