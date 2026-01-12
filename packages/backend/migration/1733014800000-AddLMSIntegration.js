export default class AddLMSIntegration1733014800000 {
    name = 'AddLMSIntegration1733014800000';

    async up(queryRunner) {
        // Add requireLMSValidation to Schools.registrationSettings
        // This is a JSONB field update, so we'll use a raw query to update the default
        await queryRunner.query(`
			ALTER TABLE "schools"
			ALTER COLUMN "registrationSettings"
			SET DEFAULT '{"allowDomainSignups": false, "requireInvitation": true, "autoGraduationEnabled": true, "allowStudentsChooseUsername": true, "requireLMSValidation": false}'
		`);

        // Update existing schools to include requireLMSValidation: false if not present
        await queryRunner.query(`
			UPDATE "schools"
			SET "registrationSettings" = jsonb_set(
				COALESCE("registrationSettings", '{}'::jsonb),
				'{requireLMSValidation}',
				'false'::jsonb,
				true
			)
			WHERE "registrationSettings" IS NULL
			   OR "registrationSettings"->>'requireLMSValidation' IS NULL
		`);

        // Create LMSSyncLog table
        await queryRunner.query(`
			CREATE TABLE "lms_sync_log" (
				"id" character varying(32) NOT NULL,
				"lmsConnectionId" character varying(32) NOT NULL,
				"schoolId" character varying(32) NOT NULL,
				"syncType" character varying(32) NOT NULL,
				"status" character varying(32) NOT NULL,
				"recordsProcessed" integer NOT NULL DEFAULT 0,
				"recordsUpdated" integer NOT NULL DEFAULT 0,
				"recordsFailed" integer NOT NULL DEFAULT 0,
				"errorDetails" jsonb,
				"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				"completedAt" TIMESTAMP WITH TIME ZONE,
				CONSTRAINT "PK_lms_sync_log" PRIMARY KEY ("id")
			)
		`);

        // Create indexes for LMSSyncLog
        await queryRunner.query(`CREATE INDEX "IDX_lms_sync_log_lmsConnectionId" ON "lms_sync_log" ("lmsConnectionId")`);
        await queryRunner.query(`CREATE INDEX "IDX_lms_sync_log_schoolId" ON "lms_sync_log" ("schoolId")`);
        await queryRunner.query(`CREATE INDEX "IDX_lms_sync_log_status" ON "lms_sync_log" ("status")`);

        // Add foreign keys for LMSSyncLog
        await queryRunner.query(`
			ALTER TABLE "lms_sync_log"
			ADD CONSTRAINT "FK_lms_sync_log_schoolId"
			FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE
		`);

        // Create RegistrationWaitlist table
        await queryRunner.query(`
			CREATE TABLE "registration_waitlist" (
				"id" character varying(32) NOT NULL,
				"schoolId" character varying(32) NOT NULL,
				"email" character varying(256) NOT NULL,
				"name" character varying(128),
				"blockedReason" character varying(32) NOT NULL,
				"notified" boolean NOT NULL DEFAULT false,
				"notifiedAt" TIMESTAMP WITH TIME ZONE,
				"registered" boolean NOT NULL DEFAULT false,
				"registeredAt" TIMESTAMP WITH TIME ZONE,
				"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				"metadata" jsonb,
				CONSTRAINT "PK_registration_waitlist" PRIMARY KEY ("id")
			)
		`);

        // Create indexes for RegistrationWaitlist
        await queryRunner.query(`CREATE INDEX "IDX_registration_waitlist_schoolId" ON "registration_waitlist" ("schoolId")`);
        await queryRunner.query(`CREATE INDEX "IDX_registration_waitlist_email" ON "registration_waitlist" ("email")`);
        await queryRunner.query(`CREATE INDEX "IDX_registration_waitlist_blockedReason" ON "registration_waitlist" ("blockedReason")`);
        await queryRunner.query(`CREATE INDEX "IDX_registration_waitlist_registered" ON "registration_waitlist" ("registered")`);

        // Add foreign keys for RegistrationWaitlist
        await queryRunner.query(`
			ALTER TABLE "registration_waitlist"
			ADD CONSTRAINT "FK_registration_waitlist_schoolId"
			FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE
		`);

        // Add comment to explain the metadata.lms field (documentation only)
        await queryRunner.query(`
			COMMENT ON COLUMN "schools"."metadata" IS
			'Additional school metadata including LMS configuration (lms.type, lms.apiUrl, lms.clientId, lms.clientSecret, lms.connectionStatus, etc.)'
		`);
    }

    async down(queryRunner) {
        // Drop RegistrationWaitlist table
        await queryRunner.query(`ALTER TABLE "registration_waitlist" DROP CONSTRAINT "FK_registration_waitlist_schoolId"`);
        await queryRunner.query(`DROP INDEX "IDX_registration_waitlist_registered"`);
        await queryRunner.query(`DROP INDEX "IDX_registration_waitlist_blockedReason"`);
        await queryRunner.query(`DROP INDEX "IDX_registration_waitlist_email"`);
        await queryRunner.query(`DROP INDEX "IDX_registration_waitlist_schoolId"`);
        await queryRunner.query(`DROP TABLE "registration_waitlist"`);

        // Drop LMSSyncLog table
        await queryRunner.query(`ALTER TABLE "lms_sync_log" DROP CONSTRAINT "FK_lms_sync_log_schoolId"`);
        await queryRunner.query(`DROP INDEX "IDX_lms_sync_log_status"`);
        await queryRunner.query(`DROP INDEX "IDX_lms_sync_log_schoolId"`);
        await queryRunner.query(`DROP INDEX "IDX_lms_sync_log_lmsConnectionId"`);
        await queryRunner.query(`DROP TABLE "lms_sync_log"`);

        // Revert Schools.registrationSettings default
        await queryRunner.query(`
			ALTER TABLE "schools"
			ALTER COLUMN "registrationSettings"
			SET DEFAULT '{"allowDomainSignups": false, "requireInvitation": true, "autoGraduationEnabled": true, "allowStudentsChooseUsername": true}'
		`);

        // Remove requireLMSValidation from existing schools
        await queryRunner.query(`
			UPDATE "schools"
			SET "registrationSettings" = "registrationSettings" - 'requireLMSValidation'
			WHERE "registrationSettings" ? 'requireLMSValidation'
		`);

        // Remove comment
        await queryRunner.query(`COMMENT ON COLUMN "schools"."metadata" IS NULL`);
    }
};
