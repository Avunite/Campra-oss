export class AddIsDemoToSchoolAndUser1757300000000 {
    name = 'AddIsDemoToSchoolAndUser1757300000000'

    async up(queryRunner) {
        console.log('Adding isDemo column to schools and user tables...');

        // Add isDemo column to schools table
        await queryRunner.query(`
            ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "isDemo" boolean NOT NULL DEFAULT false
        `);
        
        await queryRunner.query(`
            COMMENT ON COLUMN "schools"."isDemo" IS 'Whether the school is a demo school for super admin previews.'
        `);

        // Add index for quick filtering of demo schools
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_schools_isDemo" ON "schools" ("isDemo")
        `);

        // Add isDemo column to user table
        await queryRunner.query(`
            ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "isDemo" boolean NOT NULL DEFAULT false
        `);
        
        await queryRunner.query(`
            COMMENT ON COLUMN "user"."isDemo" IS 'Whether the user is a demo user for super admin previews.'
        `);

        // Add index for quick filtering of demo users
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_user_isDemo" ON "user" ("isDemo")
        `);

        console.log('✅ Added isDemo columns to schools and user tables');
    }

    async down(queryRunner) {
        console.log('Removing isDemo columns from schools and user tables...');

        // Remove indexes
        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_schools_isDemo"
        `);

        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_user_isDemo"
        `);

        // Remove columns
        await queryRunner.query(`
            ALTER TABLE "schools" DROP COLUMN IF EXISTS "isDemo"
        `);

        await queryRunner.query(`
            ALTER TABLE "user" DROP COLUMN IF EXISTS "isDemo"
        `);

        console.log('⏪ Removed isDemo columns from schools and user tables');
    }
}
