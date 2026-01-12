export class RemoveUserSubscriptions1000000020000 {
    name = 'RemoveUserSubscriptions1000000020000'
    
    async up(queryRunner) {
        // Remove subscription-related columns from user table
        // Keep stripe_user for future school billing integration
        
        // Remove subscription status fields
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "isPlus"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "isMPlus"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "subscriptionStatus"`);
        
        // Remove subscription date fields  
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "subscriptionEndDate"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "pausedSubscriptionId"`);
        
        // Remove gift credit system fields
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "giftCreditPlan"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "giftCreditEndDate"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "previousSubscriptionPlan"`);
        
        // Remove credit system fields
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "campraPlusCredits"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "miniPlusCredits"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "campraPlusCreditsExpiry"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "miniPlusCreditsExpiry"`);
        
        // Drop the subscription status enum type
        await queryRunner.query(`DROP TYPE IF EXISTS "user_subscriptionstatus_enum"`);
        
        console.log('Removed individual user subscription fields from user table');
    }

    async down(queryRunner) {
        // This is a one-way migration as part of the Campra conversion
        // The subscription system will be replaced with school-level billing
        console.log('This migration cannot be reversed - individual user subscriptions have been permanently removed');
        throw new Error('Cannot reverse removal of individual user subscription system');
    }
}
