export class AddBillingExemptToUser1700000000000 {
	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user" ADD "billingExempt" boolean NOT NULL DEFAULT false`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "billingExempt"`);
	}
}
