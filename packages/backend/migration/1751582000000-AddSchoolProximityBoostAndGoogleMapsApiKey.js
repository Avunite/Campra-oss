export class AddSchoolProximityBoostAndGoogleMapsApiKey1751582000000 {
    name = 'AddSchoolProximityBoostAndGoogleMapsApiKey1751582000000'

    async up(queryRunner) {
        console.log('Adding enableSchoolProximityBoost and googleMapsApiKey to meta table...');

        // Add enableSchoolProximityBoost column
        await queryRunner.query(`
            ALTER TABLE "meta" ADD COLUMN IF NOT EXISTS "enableSchoolProximityBoost" boolean NOT NULL DEFAULT true
        `);
        
        await queryRunner.query(`
            COMMENT ON COLUMN "meta"."enableSchoolProximityBoost" IS 'Enable proximity-based boosting for school posts in recommendation algorithm.'
        `);

        // Add googleMapsApiKey column
        await queryRunner.query(`
            ALTER TABLE "meta" ADD COLUMN IF NOT EXISTS "googleMapsApiKey" varchar(256)
        `);
        
        await queryRunner.query(`
            COMMENT ON COLUMN "meta"."googleMapsApiKey" IS 'Google Maps API key for geocoding services.'
        `);

        console.log('✅ Added enableSchoolProximityBoost and googleMapsApiKey columns to meta table');
    }

    async down(queryRunner) {
        // Remove the columns
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "googleMapsApiKey"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "enableSchoolProximityBoost"`);
        
        console.log('⏪ Removed enableSchoolProximityBoost and googleMapsApiKey columns from meta table');
    }
}
