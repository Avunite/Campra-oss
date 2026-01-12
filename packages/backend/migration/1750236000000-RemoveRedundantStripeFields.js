export class RemoveRedundantStripeFields1750236000000 {
    name = 'RemoveRedundantStripeFields1750236000000'

    async up(queryRunner) {
        // Remove redundant Stripe Plus/MPlus fields that are no longer used
        // These were replaced by the school billing system
        
        const stripePlusMonthlyExists = await queryRunner.hasColumn('meta', 'stripePlusMonthlyPriceId');
        if (stripePlusMonthlyExists) {
            await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "stripePlusMonthlyPriceId"`);
        }

        const stripePlusYearlyExists = await queryRunner.hasColumn('meta', 'stripePlusYearlyPriceId');
        if (stripePlusYearlyExists) {
            await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "stripePlusYearlyPriceId"`);
        }

        const stripeMPlusMonthlyExists = await queryRunner.hasColumn('meta', 'stripeMPlusMonthlyPriceId');
        if (stripeMPlusMonthlyExists) {
            await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "stripeMPlusMonthlyPriceId"`);
        }

        const stripeMPlusYearlyExists = await queryRunner.hasColumn('meta', 'stripeMPlusYearlyPriceId');
        if (stripeMPlusYearlyExists) {
            await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "stripeMPlusYearlyPriceId"`);
        }
    }

    async down(queryRunner) {
        // Re-add the columns if migration needs to be rolled back
        await queryRunner.query(`ALTER TABLE "meta" ADD "stripePlusMonthlyPriceId" character varying(128)`);
        await queryRunner.query(`ALTER TABLE "meta" ADD "stripePlusYearlyPriceId" character varying(128)`);
        await queryRunner.query(`ALTER TABLE "meta" ADD "stripeMPlusMonthlyPriceId" character varying(128)`);
        await queryRunner.query(`ALTER TABLE "meta" ADD "stripeMPlusYearlyPriceId" character varying(128)`);
    }
}
