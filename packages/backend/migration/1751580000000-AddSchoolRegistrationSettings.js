export class AddSchoolRegistrationSettings1751580000000 {
    name = 'AddSchoolRegistrationSettings1751580000000'

    async up(queryRunner) {
        console.log('Adding registration settings to schools table...');

        // Add registrationSettings JSONB column with default values (domain-based signup enabled by default)
        await queryRunner.query(`
            ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "registrationSettings" jsonb DEFAULT '{"allowDomainSignups": true, "requireInvitation": false, "autoGraduationEnabled": true}'
        `);
        
        await queryRunner.query(`
            COMMENT ON COLUMN "schools"."registrationSettings" IS 'School registration and management settings.'
        `);

        // Update existing schools to have the default settings (domain-based signup enabled)
        await queryRunner.query(`
            UPDATE "schools" 
            SET "registrationSettings" = '{"allowDomainSignups": true, "requireInvitation": false, "autoGraduationEnabled": true}'
            WHERE "registrationSettings" IS NULL
        `);

        console.log('✅ Added registration settings to schools table');
    }

    async down(queryRunner) {
        // Remove the column
        await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN IF EXISTS "registrationSettings"`);
        
        console.log('⏪ Removed registration settings from schools table');
    }
}