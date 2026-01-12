export class AddSchoolAdminFields1000000060000 {
    name = 'AddSchoolAdminFields1000000060000'
    
    async up(queryRunner) {
        // Add isSchoolAdmin field to user table
        await queryRunner.query(`
            ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "isSchoolAdmin" boolean NOT NULL DEFAULT false
        `);
        
        // Add adminForSchoolId field to user table  
        await queryRunner.query(`
            ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "adminForSchoolId" varchar(32)
        `);
        
        // Add indexes for the new fields
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_isSchoolAdmin" ON "user" ("isSchoolAdmin")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_adminForSchoolId" ON "user" ("adminForSchoolId")`);
        
        // Add foreign key constraint for adminForSchoolId if schools table exists
        await queryRunner.query(`
            ALTER TABLE "user" 
            ADD CONSTRAINT "FK_user_adminForSchoolId" 
            FOREIGN KEY ("adminForSchoolId") REFERENCES "schools"("id") ON DELETE SET NULL
        `);
    }
    
    async down(queryRunner) {
        // Remove foreign key constraint
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "FK_user_adminForSchoolId"`);
        
        // Remove indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_isSchoolAdmin"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_adminForSchoolId"`);
        
        // Remove columns
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "isSchoolAdmin"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "adminForSchoolId"`);
    }
}
