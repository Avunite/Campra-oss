export class AddIffyWebhookSecret1000000090001 {
    name = 'AddIffyWebhookSecret1000000090001'

    async up(queryRunner) {
        // Add Iffy webhook secret for signature verification
        const webhookSecretExists = await queryRunner.hasColumn('meta', 'iffyWebhookSecret');
        if (!webhookSecretExists) {
            await queryRunner.query(`
                ALTER TABLE "meta" 
                ADD COLUMN "iffyWebhookSecret" varchar(256)
            `);
        }

        // Add comment
        await queryRunner.query(`
            COMMENT ON COLUMN "meta"."iffyWebhookSecret" IS 'Webhook secret for Iffy webhook signature verification'
        `);

        console.log('Added Iffy webhook secret field to meta table');
    }

    async down(queryRunner) {
        const webhookSecretExists = await queryRunner.hasColumn('meta', 'iffyWebhookSecret');
        if (webhookSecretExists) {
            await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "iffyWebhookSecret"`);
        }

        console.log('Removed Iffy webhook secret field from meta table');
    }
}
