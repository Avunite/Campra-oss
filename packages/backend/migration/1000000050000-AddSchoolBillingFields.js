export class AddSchoolBillingFields1000000050000 {
    name = 'AddSchoolBillingFields1000000050000'

    async up(queryRunner) {
        // Add billing-related fields to schools table
        await queryRunner.query(`
            ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "subscriptionStatus" varchar(32) NOT NULL DEFAULT 'pending'
        `);
        
        await queryRunner.query(`
            ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "subscriptionStartDate" TIMESTAMP WITH TIME ZONE
        `);
        
        await queryRunner.query(`
            ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "lastPaymentDate" TIMESTAMP WITH TIME ZONE
        `);
        
        await queryRunner.query(`
            ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "nextBillingDate" TIMESTAMP WITH TIME ZONE
        `);
        
        await queryRunner.query(`
            ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "customRatePerStudent" decimal(8,2) NOT NULL DEFAULT 1.25
        `);
        
        await queryRunner.query(`
            ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "accessSuspendedDate" TIMESTAMP WITH TIME ZONE
        `);
        
        // Add indexes for performance
        await queryRunner.query(`CREATE INDEX "IDX_schools_subscriptionStatus" ON "schools" ("subscriptionStatus")`);
        await queryRunner.query(`CREATE INDEX "IDX_schools_nextBillingDate" ON "schools" ("nextBillingDate")`);
        
        console.log('✅ Added billing fields to schools table');
    }

    async down(queryRunner) {
        // Remove indexes first
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_schools_subscriptionStatus"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_schools_nextBillingDate"`);
        
        // Remove columns
        await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN IF EXISTS "subscriptionStatus"`);
        await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN IF EXISTS "subscriptionStartDate"`);
        await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN IF EXISTS "lastPaymentDate"`);
        await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN IF EXISTS "nextBillingDate"`);
        await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN IF EXISTS "customRatePerStudent"`);
        await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN IF EXISTS "accessSuspendedDate"`);
        
        console.log('⏪ Removed billing fields from schools table');
    }
}
