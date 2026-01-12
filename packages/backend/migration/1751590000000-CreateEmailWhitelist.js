export class CreateEmailWhitelist1751590000000 {
    name = 'CreateEmailWhitelist1751590000000'

    async up(queryRunner) {
        // Create email_whitelists table
        await queryRunner.query(`
            CREATE TABLE "email_whitelists" (
                "id" varchar(32) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "schoolId" varchar(32) NOT NULL,
                "email" varchar(256) NOT NULL,
                "name" varchar(100),
                "gradeLevel" varchar(32),
                "invitationSent" boolean NOT NULL DEFAULT false,
                "invitationSentAt" TIMESTAMP WITH TIME ZONE,
                "registered" boolean NOT NULL DEFAULT false,
                "registeredAt" TIMESTAMP WITH TIME ZONE,
                "userId" varchar(32),
                "addedBy" varchar(32) NOT NULL,
                "notes" varchar(256),
                CONSTRAINT "PK_email_whitelists" PRIMARY KEY ("id")
            )
        `);
        
        // Create indexes
        await queryRunner.query(`CREATE INDEX "IDX_email_whitelists_schoolId" ON "email_whitelists" ("schoolId")`);
        await queryRunner.query(`CREATE INDEX "IDX_email_whitelists_email" ON "email_whitelists" ("email")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_email_whitelists_schoolId_email" ON "email_whitelists" ("schoolId", "email")`);
        
        // Add foreign key constraint for schoolId
        await queryRunner.query(`
            ALTER TABLE "email_whitelists" 
            ADD CONSTRAINT "FK_email_whitelists_schoolId" 
            FOREIGN KEY ("schoolId") 
            REFERENCES "schools"("id") 
            ON DELETE CASCADE 
            ON UPDATE NO ACTION
        `);
        
        // Add comments
        await queryRunner.query(`COMMENT ON COLUMN "email_whitelists"."id" IS 'The ID of the whitelist entry.'`);
        await queryRunner.query(`COMMENT ON COLUMN "email_whitelists"."createdAt" IS 'The created date of the whitelist entry.'`);
        await queryRunner.query(`COMMENT ON COLUMN "email_whitelists"."schoolId" IS 'The school ID.'`);
        await queryRunner.query(`COMMENT ON COLUMN "email_whitelists"."email" IS 'Whitelisted email address (lowercase).'`);
        await queryRunner.query(`COMMENT ON COLUMN "email_whitelists"."name" IS 'Optional name associated with the email.'`);
        await queryRunner.query(`COMMENT ON COLUMN "email_whitelists"."gradeLevel" IS 'Grade level for pre-assignment (e.g., "Freshman", "Sophomore", "9", "10").'`);
        await queryRunner.query(`COMMENT ON COLUMN "email_whitelists"."invitationSent" IS 'Whether an invitation email has been sent.'`);
        await queryRunner.query(`COMMENT ON COLUMN "email_whitelists"."invitationSentAt" IS 'When the invitation was sent.'`);
        await queryRunner.query(`COMMENT ON COLUMN "email_whitelists"."registered" IS 'Whether the user has registered using this whitelist entry.'`);
        await queryRunner.query(`COMMENT ON COLUMN "email_whitelists"."registeredAt" IS 'When the user registered.'`);
        await queryRunner.query(`COMMENT ON COLUMN "email_whitelists"."userId" IS 'The user ID if they have registered.'`);
        await queryRunner.query(`COMMENT ON COLUMN "email_whitelists"."addedBy" IS 'Who added this whitelist entry.'`);
        await queryRunner.query(`COMMENT ON COLUMN "email_whitelists"."notes" IS 'Optional notes about this whitelist entry.'`);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE "email_whitelists"`);
    }
}
