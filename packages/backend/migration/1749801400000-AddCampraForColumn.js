export class AddCampraForColumn1749801400000 {
    name = 'AddCampraForColumn1749801400000'

    async up(queryRunner) {
        // Add campraFor column to note table if it doesn't exist
        const campraForExists = await queryRunner.hasColumn('note', 'campraFor');
        if (!campraForExists) {
            await queryRunner.query(`ALTER TABLE "note" ADD "campraFor" character varying(128)`);
        }
    }

    async down(queryRunner) {
        // Remove campraFor column if it exists
        const campraForExists = await queryRunner.hasColumn('note', 'campraFor');
        if (campraForExists) {
            await queryRunner.query(`ALTER TABLE "note" DROP COLUMN "campraFor"`);
        }
    }
}
