export class AddAutomodAccountToMeta1751576000000 {
    name = 'AddAutomodAccountToMeta1751576000000'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" ADD "automodAccountId" character varying(32)`);
        await queryRunner.query(`ALTER TABLE "meta" ADD CONSTRAINT "FK_automod_account_id" FOREIGN KEY ("automodAccountId") REFERENCES "user"("id") ON DELETE SET NULL`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" DROP CONSTRAINT "FK_automod_account_id"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "automodAccountId"`);
    }
}
