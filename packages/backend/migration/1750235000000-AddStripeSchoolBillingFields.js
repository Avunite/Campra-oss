export class AddStripeSchoolBillingFields1750235000000 {
    name = 'AddStripeSchoolBillingFields1750235000000'

    async up(queryRunner) {
        // Add essential Stripe fields for school billing system
        
        const stripeKeyExists = await queryRunner.hasColumn('meta', 'stripeKey');
        if (!stripeKeyExists) {
            await queryRunner.query(`ALTER TABLE "meta" ADD "stripeKey" character varying(512)`);
        }

        const stripeWebhookSecretExists = await queryRunner.hasColumn('meta', 'stripeWebhookSecret');
        if (!stripeWebhookSecretExists) {
            await queryRunner.query(`ALTER TABLE "meta" ADD "stripeWebhookSecret" character varying(512)`);
        }

        const stripeSchoolPriceIdExists = await queryRunner.hasColumn('meta', 'stripeSchoolPriceId');
        if (!stripeSchoolPriceIdExists) {
            await queryRunner.query(`ALTER TABLE "meta" ADD "stripeSchoolPriceId" character varying(128)`);
        }
    }

    async down(queryRunner) {
        // Remove the Stripe fields if migration needs to be rolled back
        const stripeKeyExists = await queryRunner.hasColumn('meta', 'stripeKey');
        if (stripeKeyExists) {
            await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "stripeKey"`);
        }

        const stripeWebhookSecretExists = await queryRunner.hasColumn('meta', 'stripeWebhookSecret');
        if (stripeWebhookSecretExists) {
            await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "stripeWebhookSecret"`);
        }

        const stripeSchoolPriceIdExists = await queryRunner.hasColumn('meta', 'stripeSchoolPriceId');
        if (stripeSchoolPriceIdExists) {
            await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "stripeSchoolPriceId"`);
        }
    }
}
