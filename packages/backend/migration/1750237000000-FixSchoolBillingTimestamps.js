export class FixSchoolBillingTimestamps1750237000000 {
    name = 'FixSchoolBillingTimestamps1750237000000'

    async up(queryRunner) {
        // Add default values to existing timestamp columns in school_billing table
        await queryRunner.query(`
            ALTER TABLE "school_billing" 
            ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP
        `);
        
        await queryRunner.query(`
            ALTER TABLE "school_billing" 
            ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP
        `);
        
        // Create trigger to automatically update updatedAt column
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION update_school_billing_timestamp()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW."updatedAt" = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);
        
        await queryRunner.query(`
            CREATE TRIGGER school_billing_updated_at_trigger
            BEFORE UPDATE ON "school_billing"
            FOR EACH ROW
            EXECUTE FUNCTION update_school_billing_timestamp();
        `);
    }

    async down(queryRunner) {
        // Remove trigger and function
        await queryRunner.query(`DROP TRIGGER IF EXISTS school_billing_updated_at_trigger ON "school_billing"`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS update_school_billing_timestamp()`);
        
        // Remove default values
        await queryRunner.query(`
            ALTER TABLE "school_billing" 
            ALTER COLUMN "createdAt" DROP DEFAULT
        `);
        
        await queryRunner.query(`
            ALTER TABLE "school_billing" 
            ALTER COLUMN "updatedAt" DROP DEFAULT
        `);
    }
}
