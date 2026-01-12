export class AddSchoolCoordinates1751580100000 {
    name = 'AddSchoolCoordinates1751580100000'

    async up(queryRunner) {
        console.log('Adding coordinates to schools table...');

        // Add coordinates point column
        await queryRunner.query(`
            ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "coordinates" point
        `);
        
        await queryRunner.query(`
            COMMENT ON COLUMN "schools"."coordinates" IS 'Geographic coordinates for location-based features.'
        `);

        // Add spatial index for location queries
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_schools_coordinates" ON "schools" USING GIST ("coordinates")
        `);

        console.log('✅ Added coordinates and spatial index to schools table');
    }

    async down(queryRunner) {
        // Remove index first
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_schools_coordinates"`);
        
        // Remove the column
        await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN IF EXISTS "coordinates"`);
        
        console.log('⏪ Removed coordinates from schools table');
    }
}