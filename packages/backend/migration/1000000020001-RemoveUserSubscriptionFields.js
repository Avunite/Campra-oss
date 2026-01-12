export class RemoveUserSubscriptionFields1000000020001 {
    async up(queryRunner) {
        // Remove subscription-related columns from user table
        try {
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "isPlus"`);
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "isMPlus"`);
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "subscriptionEndDate"`);
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "pausedSubscriptionId"`);
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "giftCreditPlan"`);
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "giftCreditEndDate"`);
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "previousSubscriptionPlan"`);
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "subscriptionStatus"`);
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "campraPlusCredits"`);
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "miniPlusCredits"`);
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "campraPlusCreditsExpiry"`);
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "miniPlusCreditsExpiry"`);
        } catch (error) {
            console.log("Error removing subscription columns:", error);
            // Continue migration even if some columns don't exist
        }
    }

    async down(queryRunner) {
        // Add back subscription-related columns
        await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "isPlus" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "isMPlus" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "subscriptionEndDate" timestamp with time zone`);
        await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "pausedSubscriptionId" varchar`);
        await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "giftCreditPlan" varchar(10)`);
        await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "giftCreditEndDate" timestamp with time zone`);
        await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "previousSubscriptionPlan" varchar(10)`);
        await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "subscriptionStatus" varchar NOT NULL DEFAULT 'free'`);
        await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "campraPlusCredits" integer NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "miniPlusCredits" integer NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "campraPlusCreditsExpiry" timestamp with time zone`);
        await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "miniPlusCreditsExpiry" timestamp with time zone`);
    }
}
