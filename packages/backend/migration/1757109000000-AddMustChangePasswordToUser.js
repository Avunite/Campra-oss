export class AddMustChangePasswordToUser1757109000000 {
    name = 'AddMustChangePasswordToUser1757109000000'

    async up(queryRunner) {
        console.log('Adding mustChangePassword column to user table...');

        // Add mustChangePassword column to user table
        await queryRunner.query(`
            ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "mustChangePassword" boolean NOT NULL DEFAULT false
        `);
        
        await queryRunner.query(`
            COMMENT ON COLUMN "user"."mustChangePassword" IS 'Whether the user must change their password on next login.'
        `);

        console.log('✅ Added mustChangePassword column to user table');
    }

    async down(queryRunner) {
        console.log('Removing mustChangePassword column from user table...');

        await queryRunner.query(`
            ALTER TABLE "user" DROP COLUMN IF EXISTS "mustChangePassword"
        `);

        console.log('⏪ Removed mustChangePassword column from user table');
    }
}
