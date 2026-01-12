export class CreateSchoolAdminVerification1751580200000 {
    name = 'CreateSchoolAdminVerification1751580200000'

    async up(queryRunner) {
        console.log('Creating school_admin_verifications table...');

        // Create the school_admin_verifications table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "school_admin_verifications" (
                "id" varchar(32) NOT NULL,
                "schoolId" varchar(32) NOT NULL,
                "email" varchar(128) NOT NULL,
                "token" varchar(64) NOT NULL,
                "expiresAt" timestamp with time zone NOT NULL,
                "verified" boolean NOT NULL DEFAULT false,
                "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
                CONSTRAINT "PK_school_admin_verifications" PRIMARY KEY ("id")
            )
        `);

        // Add comments
        await queryRunner.query(`COMMENT ON COLUMN "school_admin_verifications"."id" IS 'Primary key'`);
        await queryRunner.query(`COMMENT ON COLUMN "school_admin_verifications"."schoolId" IS 'The school ID.'`);
        await queryRunner.query(`COMMENT ON COLUMN "school_admin_verifications"."email" IS 'Admin email address.'`);
        await queryRunner.query(`COMMENT ON COLUMN "school_admin_verifications"."token" IS 'Verification token.'`);
        await queryRunner.query(`COMMENT ON COLUMN "school_admin_verifications"."expiresAt" IS 'Token expiration date.'`);
        await queryRunner.query(`COMMENT ON COLUMN "school_admin_verifications"."verified" IS 'Whether verification is complete.'`);
        await queryRunner.query(`COMMENT ON COLUMN "school_admin_verifications"."createdAt" IS 'The created date of the verification request.'`);

        // Create indexes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_school_admin_verifications_schoolId" ON "school_admin_verifications" ("schoolId")`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_school_admin_verifications_token" ON "school_admin_verifications" ("token")`);

        console.log('✅ Created school_admin_verifications table with indexes');
    }

    async down(queryRunner) {
        // Drop indexes first
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_school_admin_verifications_schoolId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_school_admin_verifications_token"`);
        
        // Drop the table
        await queryRunner.query(`DROP TABLE IF EXISTS "school_admin_verifications"`);
        
        console.log('⏪ Removed school_admin_verifications table');
    }
}