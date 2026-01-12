export class FixContentModerationFieldNames1751575500000 {
    name = 'FixContentModerationFieldNames1751575500000'

    async up(queryRunner) {
        // Fix field name conflicts between old and new migrations
        
        // Check if old field names exist and rename them to match entity
        const contentModerationApiKeyExists = await queryRunner.hasColumn('meta', 'contentModerationApiKey');
        if (contentModerationApiKeyExists) {
            // Copy data from old field to new field if new field doesn't exist
            const iffyApiKeyExists = await queryRunner.hasColumn('meta', 'iffyApiKey');
            if (!iffyApiKeyExists) {
                await queryRunner.query(`ALTER TABLE "meta" ADD COLUMN "iffyApiKey" varchar(256)`);
                await queryRunner.query(`UPDATE "meta" SET "iffyApiKey" = "contentModerationApiKey" WHERE "contentModerationApiKey" IS NOT NULL`);
            }
            // Drop the old field
            await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "contentModerationApiKey"`);
        }

        const contentModerationSensitivityExists = await queryRunner.hasColumn('meta', 'contentModerationSensitivity');
        if (contentModerationSensitivityExists) {
            // Copy data from old field to new field if new field doesn't exist
            const iffyConfidenceThresholdExists = await queryRunner.hasColumn('meta', 'iffyConfidenceThreshold');
            if (!iffyConfidenceThresholdExists) {
                await queryRunner.query(`ALTER TABLE "meta" ADD COLUMN "iffyConfidenceThreshold" varchar(16) DEFAULT 'medium'`);
                await queryRunner.query(`UPDATE "meta" SET "iffyConfidenceThreshold" = "contentModerationSensitivity" WHERE "contentModerationSensitivity" IS NOT NULL`);
            }
            // Drop the old field
            await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "contentModerationSensitivity"`);
        }

        console.log('Fixed content moderation field naming conflicts');
    }

    async down(queryRunner) {
        // Recreate old field names if needed for rollback
        const iffyApiKeyExists = await queryRunner.hasColumn('meta', 'iffyApiKey');
        if (iffyApiKeyExists) {
            await queryRunner.query(`ALTER TABLE "meta" ADD COLUMN "contentModerationApiKey" varchar(256)`);
            await queryRunner.query(`UPDATE "meta" SET "contentModerationApiKey" = "iffyApiKey" WHERE "iffyApiKey" IS NOT NULL`);
            await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "iffyApiKey"`);
        }

        const iffyConfidenceThresholdExists = await queryRunner.hasColumn('meta', 'iffyConfidenceThreshold');
        if (iffyConfidenceThresholdExists) {
            await queryRunner.query(`ALTER TABLE "meta" ADD COLUMN "contentModerationSensitivity" varchar(16) DEFAULT 'medium'`);
            await queryRunner.query(`UPDATE "meta" SET "contentModerationSensitivity" = "iffyConfidenceThreshold" WHERE "iffyConfidenceThreshold" IS NOT NULL`);
            await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "iffyConfidenceThreshold"`);
        }

        console.log('Reverted content moderation field naming changes');
    }
}
