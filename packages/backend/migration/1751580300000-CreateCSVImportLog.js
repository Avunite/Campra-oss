export class CreateCSVImportLog1751580300000 {
    name = 'CreateCSVImportLog1751580300000'

    async up(queryRunner) {
        console.log('Creating csv_import_logs table...');

        // Create the csv_import_logs table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "csv_import_logs" (
                "id" varchar(32) NOT NULL,
                "schoolId" varchar(32) NOT NULL,
                "importedBy" varchar(32) NOT NULL,
                "totalRows" integer NOT NULL,
                "successfulRows" integer NOT NULL,
                "errors" jsonb NOT NULL DEFAULT '[]',
                "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
                CONSTRAINT "PK_csv_import_logs" PRIMARY KEY ("id")
            )
        `);

        // Add comments
        await queryRunner.query(`COMMENT ON COLUMN "csv_import_logs"."id" IS 'Primary key'`);
        await queryRunner.query(`COMMENT ON COLUMN "csv_import_logs"."schoolId" IS 'The school ID.'`);
        await queryRunner.query(`COMMENT ON COLUMN "csv_import_logs"."importedBy" IS 'Admin who initiated import.'`);
        await queryRunner.query(`COMMENT ON COLUMN "csv_import_logs"."totalRows" IS 'Total rows in CSV.'`);
        await queryRunner.query(`COMMENT ON COLUMN "csv_import_logs"."successfulRows" IS 'Successfully processed rows.'`);
        await queryRunner.query(`COMMENT ON COLUMN "csv_import_logs"."errors" IS 'Import errors and details.'`);
        await queryRunner.query(`COMMENT ON COLUMN "csv_import_logs"."createdAt" IS 'The created date of the import log.'`);

        // Create indexes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_csv_import_logs_schoolId" ON "csv_import_logs" ("schoolId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_csv_import_logs_createdAt" ON "csv_import_logs" ("createdAt")`);

        console.log('✅ Created csv_import_logs table with indexes');
    }

    async down(queryRunner) {
        // Drop indexes first
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_csv_import_logs_schoolId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_csv_import_logs_createdAt"`);
        
        // Drop the table
        await queryRunner.query(`DROP TABLE IF EXISTS "csv_import_logs"`);
        
        console.log('⏪ Removed csv_import_logs table');
    }
}