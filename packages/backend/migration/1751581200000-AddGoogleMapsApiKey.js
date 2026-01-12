export class AddGoogleMapsApiKey1751581200000 {
    name = 'AddGoogleMapsApiKey1751581200000'

    async up(queryRunner) {
        console.log('Adding Google Maps API key to meta table...');

        // Add googleMapsApiKey column to meta table
        await queryRunner.query(`
            ALTER TABLE "meta" ADD COLUMN IF NOT EXISTS "googleMapsApiKey" varchar(256) NULL
        `);
        
        await queryRunner.query(`
            COMMENT ON COLUMN "meta"."googleMapsApiKey" IS 'Google Maps API key for geocoding services.'
        `);

        console.log('✅ Added Google Maps API key column to meta table');
    }

    async down(queryRunner) {
        // Remove the column
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "googleMapsApiKey"`);
        
        console.log('⏪ Removed Google Maps API key from meta table');
    }
}
