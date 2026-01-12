export class AddAllowStudentsChooseUsername1762888851000 {
    name = 'AddAllowStudentsChooseUsername1762888851000'

    async up(queryRunner) {
        console.log('Adding allowStudentsChooseUsername to school registration settings...');

        // Update existing schools to include the new allowStudentsChooseUsername field (default: true)
        // This preserves existing behavior where students could choose their own usernames
        await queryRunner.query(`
            UPDATE "schools" 
            SET "registrationSettings" = 
                CASE 
                    WHEN "registrationSettings" IS NULL THEN 
                        '{"allowDomainSignups": true, "requireInvitation": false, "autoGraduationEnabled": true, "allowStudentsChooseUsername": true}'::jsonb
                    ELSE 
                        "registrationSettings" || '{"allowStudentsChooseUsername": true}'::jsonb
                END
            WHERE "registrationSettings" IS NULL 
               OR NOT ("registrationSettings" ? 'allowStudentsChooseUsername')
        `);

        console.log('✅ Added allowStudentsChooseUsername to school registration settings');
    }

    async down(queryRunner) {
        // Remove the allowStudentsChooseUsername field from existing schools
        await queryRunner.query(`
            UPDATE "schools" 
            SET "registrationSettings" = "registrationSettings" - 'allowStudentsChooseUsername'
            WHERE "registrationSettings" ? 'allowStudentsChooseUsername'
        `);
        
        console.log('⏪ Removed allowStudentsChooseUsername from school registration settings');
    }
}
