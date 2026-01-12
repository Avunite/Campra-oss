export class AddContentModerationToMeta1000000090000 {
    name = 'AddContentModerationToMeta1000000090000'

    async up(queryRunner) {
        // Add content moderation enable/disable
        const enableContentModerationExists = await queryRunner.hasColumn('meta', 'enableContentModeration');
        if (!enableContentModerationExists) {
            await queryRunner.query(`
                ALTER TABLE "meta" 
                ADD COLUMN "enableContentModeration" boolean NOT NULL DEFAULT false
            `);
        }

        // Add API key for external moderation service (iffy)
        const apiKeyExists = await queryRunner.hasColumn('meta', 'contentModerationApiKey');
        if (!apiKeyExists) {
            await queryRunner.query(`
                ALTER TABLE "meta" 
                ADD COLUMN "contentModerationApiKey" varchar(256)
            `);
        }

        // Add sensitivity level
        const sensitivityExists = await queryRunner.hasColumn('meta', 'contentModerationSensitivity');
        if (!sensitivityExists) {
            await queryRunner.query(`
                ALTER TABLE "meta" 
                ADD COLUMN "contentModerationSensitivity" varchar(16) NOT NULL DEFAULT 'medium'
            `);
        }

        // Add auto-hide setting
        const autoHideExists = await queryRunner.hasColumn('meta', 'autoHideInappropriateContent');
        if (!autoHideExists) {
            await queryRunner.query(`
                ALTER TABLE "meta" 
                ADD COLUMN "autoHideInappropriateContent" boolean NOT NULL DEFAULT true
            `);
        }

        // Add school-specific content moderation
        const schoolModerationExists = await queryRunner.hasColumn('meta', 'enableSchoolContentModeration');
        if (!schoolModerationExists) {
            await queryRunner.query(`
                ALTER TABLE "meta" 
                ADD COLUMN "enableSchoolContentModeration" boolean NOT NULL DEFAULT false
            `);
        }

        // Add comments
        await queryRunner.query(`
            COMMENT ON COLUMN "meta"."enableContentModeration" IS 'Enable automatic content moderation using external service'
        `);
        
        await queryRunner.query(`
            COMMENT ON COLUMN "meta"."contentModerationApiKey" IS 'API key for external content moderation service (e.g., iffy)'
        `);
        
        await queryRunner.query(`
            COMMENT ON COLUMN "meta"."contentModerationSensitivity" IS 'Sensitivity level for content moderation (low, medium, high)'
        `);
        
        await queryRunner.query(`
            COMMENT ON COLUMN "meta"."autoHideInappropriateContent" IS 'Automatically hide content flagged as inappropriate'
        `);
        
        await queryRunner.query(`
            COMMENT ON COLUMN "meta"."enableSchoolContentModeration" IS 'Enable enhanced content moderation for school environments'
        `);

        console.log('Added content moderation fields to meta table');
    }

    async down(queryRunner) {
        // Remove columns if they exist
        const enableContentModerationExists = await queryRunner.hasColumn('meta', 'enableContentModeration');
        if (enableContentModerationExists) {
            await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "enableContentModeration"`);
        }

        const apiKeyExists = await queryRunner.hasColumn('meta', 'contentModerationApiKey');
        if (apiKeyExists) {
            await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "contentModerationApiKey"`);
        }

        const sensitivityExists = await queryRunner.hasColumn('meta', 'contentModerationSensitivity');
        if (sensitivityExists) {
            await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "contentModerationSensitivity"`);
        }

        const autoHideExists = await queryRunner.hasColumn('meta', 'autoHideInappropriateContent');
        if (autoHideExists) {
            await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "autoHideInappropriateContent"`);
        }

        const schoolModerationExists = await queryRunner.hasColumn('meta', 'enableSchoolContentModeration');
        if (schoolModerationExists) {
            await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "enableSchoolContentModeration"`);
        }

        console.log('Removed content moderation fields from meta table');
    }
}
