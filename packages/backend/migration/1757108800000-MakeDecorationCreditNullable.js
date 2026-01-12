export class MakeDecorationCreditNullable1757108800000 {
    name = 'MakeDecorationCreditNullable1757108800000'

    async up(queryRunner) {
        console.log('Making decoration credit column nullable...');

        // Make the credit column nullable in the decoration table
        await queryRunner.query(`
            ALTER TABLE "decoration" ALTER COLUMN "credit" DROP NOT NULL
        `);

        console.log('✅ Made decoration credit column nullable');
    }

    async down(queryRunner) {
        console.log('Reverting decoration credit column to not null...');

        // First update any null values with a default value before making it not null
        await queryRunner.query(`
            UPDATE "decoration" SET "credit" = 'Unknown' WHERE "credit" IS NULL
        `);

        // Make the credit column not null again
        await queryRunner.query(`
            ALTER TABLE "decoration" ALTER COLUMN "credit" SET NOT NULL
        `);

        console.log('⏪ Reverted decoration credit column to not null');
    }
}
