export class AddSubscriptionFieldsToSchool1000000080000 {
    name = 'AddSubscriptionFieldsToSchool1000000080000'

    async up(queryRunner) {
        // Add subscriptionStatus column if it doesn't exist
        const subscriptionStatusExists = await queryRunner.hasColumn('schools', 'subscriptionStatus');
        if (!subscriptionStatusExists) {
            await queryRunner.query(`
                ALTER TABLE "schools" 
                ADD COLUMN "subscriptionStatus" varchar(32) NOT NULL DEFAULT 'inactive'
            `);
            
            await queryRunner.query(`
                COMMENT ON COLUMN "schools"."subscriptionStatus" IS 'Current subscription status of the school'
            `);
        }
        
        // Add metadata column if it doesn't exist
        const metadataExists = await queryRunner.hasColumn('schools', 'metadata');
        if (!metadataExists) {
            await queryRunner.query(`
                ALTER TABLE "schools" 
                ADD COLUMN "metadata" jsonb DEFAULT '{}'
            `);
            
            await queryRunner.query(`
                COMMENT ON COLUMN "schools"."metadata" IS 'Additional subscription and admin metadata'
            `);
        }
        
        // Add index on subscriptionStatus if it doesn't exist
        const indexCheck = await queryRunner.query(`
            SELECT indexname FROM pg_indexes 
            WHERE tablename = 'schools' AND indexname = 'IDX_schools_subscriptionStatus'
        `);
        
        if (indexCheck.length === 0) {
            await queryRunner.query(`
                CREATE INDEX "IDX_schools_subscriptionStatus" ON "schools" ("subscriptionStatus")
            `);
        }

        console.log('Added subscriptionStatus and metadata fields to schools table (if they did not exist)');
    }

    async down(queryRunner) {
        // Remove index
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_schools_subscriptionStatus"`);
        
        // Remove columns
        await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN IF EXISTS "metadata"`);
        await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN IF EXISTS "subscriptionStatus"`);
        
        console.log('Removed subscriptionStatus and metadata fields from schools table');
    }
}
