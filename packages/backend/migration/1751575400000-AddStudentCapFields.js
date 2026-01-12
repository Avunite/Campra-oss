export class AddStudentCapFields1751575400000 {
    name = 'AddStudentCapFields1751575400000'

    async up(queryRunner) {
        console.log('Adding student cap fields for prepaid billing system...');

        // Add student cap fields to schools table
        await queryRunner.query(`
            ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "studentCap" integer DEFAULT NULL
        `);
        
        await queryRunner.query(`
            COMMENT ON COLUMN "schools"."studentCap" IS 'Maximum number of students allowed before blocking registration (prepaid model)'
        `);

        await queryRunner.query(`
            ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "studentCapEnforced" boolean DEFAULT false
        `);
        
        await queryRunner.query(`
            COMMENT ON COLUMN "schools"."studentCapEnforced" IS 'Whether student cap limits are actively enforced'
        `);

        await queryRunner.query(`
            ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "studentCapSetAt" timestamp with time zone
        `);
        
        await queryRunner.query(`
            COMMENT ON COLUMN "schools"."studentCapSetAt" IS 'When the student cap was last modified'
        `);

        await queryRunner.query(`
            ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "studentCapSetBy" varchar(32)
        `);
        
        await queryRunner.query(`
            COMMENT ON COLUMN "schools"."studentCapSetBy" IS 'User ID who last modified the student cap'
        `);

        // Add billing mode fields to school_billing table
        await queryRunner.query(`
            ALTER TABLE "school_billing" ADD COLUMN IF NOT EXISTS "billingMode" varchar(32) DEFAULT 'per_student'
        `);
        
        await queryRunner.query(`
            COMMENT ON COLUMN "school_billing"."billingMode" IS 'Billing calculation method: per_student or prepaid_cap'
        `);

        await queryRunner.query(`
            ALTER TABLE "school_billing" ADD COLUMN IF NOT EXISTS "billedStudentCap" integer
        `);
        
        await queryRunner.query(`
            COMMENT ON COLUMN "school_billing"."billedStudentCap" IS 'The student cap that was billed for in prepaid model'
        `);

        // Add indexes for performance
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_schools_studentCapEnforced" ON "schools" ("studentCapEnforced")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_school_billing_billingMode" ON "school_billing" ("billingMode")`);

        console.log('✅ Added student cap fields for prepaid billing system');
    }

    async down(queryRunner) {
        // Remove indexes first
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_schools_studentCapEnforced"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_school_billing_billingMode"`);
        
        // Remove columns
        await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN IF EXISTS "studentCap"`);
        await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN IF EXISTS "studentCapEnforced"`);
        await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN IF EXISTS "studentCapSetAt"`);
        await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN IF EXISTS "studentCapSetBy"`);
        
        await queryRunner.query(`ALTER TABLE "school_billing" DROP COLUMN IF EXISTS "billingMode"`);
        await queryRunner.query(`ALTER TABLE "school_billing" DROP COLUMN IF EXISTS "billedStudentCap"`);
        
        console.log('⏪ Removed student cap fields from schools and school_billing tables');
    }
}
