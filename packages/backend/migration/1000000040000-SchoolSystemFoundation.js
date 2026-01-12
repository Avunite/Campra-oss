export class SchoolSystemFoundation1000000040000 {
    name = 'SchoolSystemFoundation1000000040000'
    
    async up(queryRunner) {
        // 1. Create schools table
        await queryRunner.query(`
            CREATE TABLE "schools" (
                "id" varchar(32) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "name" varchar(256) NOT NULL,
                "domain" varchar(128) NOT NULL UNIQUE,
                "type" varchar(32) NOT NULL DEFAULT 'university',
                "location" varchar(512),
                "logoUrl" varchar(512),
                "websiteUrl" varchar(512),
                "isActive" boolean NOT NULL DEFAULT true,
                "maxStudents" integer DEFAULT NULL,
                "graduationMonths" integer array NOT NULL DEFAULT '{5,12}',
                "academicYearStart" integer NOT NULL DEFAULT 9,
                "timezone" varchar(64) DEFAULT 'UTC',
                "settings" jsonb NOT NULL DEFAULT '{}',
                CONSTRAINT "PK_schools" PRIMARY KEY ("id")
            )
        `);
        
        await queryRunner.query(`CREATE INDEX "IDX_schools_domain" ON "schools" ("domain")`);
        await queryRunner.query(`CREATE INDEX "IDX_schools_type" ON "schools" ("type")`);
        await queryRunner.query(`CREATE INDEX "IDX_schools_isActive" ON "schools" ("isActive")`);

        // 2. Create school_domains table for domain verification
        await queryRunner.query(`
            CREATE TABLE "school_domains" (
                "id" varchar(32) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "schoolId" varchar(32) NOT NULL,
                "domain" varchar(128) NOT NULL,
                "isVerified" boolean NOT NULL DEFAULT false,
                "verificationToken" varchar(64),
                "verificationMethod" varchar(32) NOT NULL DEFAULT 'dns',
                "verifiedAt" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_school_domains" PRIMARY KEY ("id")
            )
        `);
        
        await queryRunner.query(`CREATE INDEX "IDX_school_domains_schoolId" ON "school_domains" ("schoolId")`);
        await queryRunner.query(`CREATE INDEX "IDX_school_domains_domain" ON "school_domains" ("domain")`);
        await queryRunner.query(`CREATE INDEX "IDX_school_domains_isVerified" ON "school_domains" ("isVerified")`);
        
        await queryRunner.query(`
            ALTER TABLE "school_domains" 
            ADD CONSTRAINT "FK_school_domains_schoolId" 
            FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE
        `);

        // 3. Create campus_blocks table for relationship management
        await queryRunner.query(`
            CREATE TABLE "campus_blocks" (
                "id" varchar(32) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "schoolId" varchar(32) NOT NULL,
                "blockedSchoolId" varchar(32) NOT NULL,
                "reason" varchar(512),
                "createdByUserId" varchar(32),
                CONSTRAINT "PK_campus_blocks" PRIMARY KEY ("id")
            )
        `);
        
        await queryRunner.query(`CREATE INDEX "IDX_campus_blocks_schoolId" ON "campus_blocks" ("schoolId")`);
        await queryRunner.query(`CREATE INDEX "IDX_campus_blocks_blockedSchoolId" ON "campus_blocks" ("blockedSchoolId")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_campus_blocks_unique" ON "campus_blocks" ("schoolId", "blockedSchoolId")`);
        
        await queryRunner.query(`
            ALTER TABLE "campus_blocks" 
            ADD CONSTRAINT "FK_campus_blocks_schoolId" 
            FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE
        `);
        
        await queryRunner.query(`
            ALTER TABLE "campus_blocks" 
            ADD CONSTRAINT "FK_campus_blocks_blockedSchoolId" 
            FOREIGN KEY ("blockedSchoolId") REFERENCES "schools"("id") ON DELETE CASCADE
        `);
        
        await queryRunner.query(`
            ALTER TABLE "campus_blocks" 
            ADD CONSTRAINT "FK_campus_blocks_createdByUserId" 
            FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE SET NULL
        `);

        // 4. Create content_flags table for automatic moderation
        await queryRunner.query(`
            CREATE TABLE "content_flags" (
                "id" varchar(32) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "contentType" varchar(32) NOT NULL,
                "contentId" varchar(32) NOT NULL,
                "flagType" varchar(32) NOT NULL,
                "confidence" decimal(3,2),
                "source" varchar(32) NOT NULL DEFAULT 'iffy',
                "metadata" jsonb NOT NULL DEFAULT '{}',
                "status" varchar(32) NOT NULL DEFAULT 'pending',
                "reviewedAt" TIMESTAMP WITH TIME ZONE,
                "reviewedByUserId" varchar(32),
                "action" varchar(32),
                CONSTRAINT "PK_content_flags" PRIMARY KEY ("id")
            )
        `);
        
        await queryRunner.query(`CREATE INDEX "IDX_content_flags_contentType" ON "content_flags" ("contentType")`);
        await queryRunner.query(`CREATE INDEX "IDX_content_flags_contentId" ON "content_flags" ("contentId")`);
        await queryRunner.query(`CREATE INDEX "IDX_content_flags_flagType" ON "content_flags" ("flagType")`);
        await queryRunner.query(`CREATE INDEX "IDX_content_flags_status" ON "content_flags" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_content_flags_source" ON "content_flags" ("source")`);
        
        await queryRunner.query(`
            ALTER TABLE "content_flags" 
            ADD CONSTRAINT "FK_content_flags_reviewedByUserId" 
            FOREIGN KEY ("reviewedByUserId") REFERENCES "user"("id") ON DELETE SET NULL
        `);

        // 5. Create pricing_history table for billing audit trail
        await queryRunner.query(`
            CREATE TABLE "pricing_history" (
                "id" varchar(32) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "entityType" varchar(32) NOT NULL,
                "entityId" varchar(32) NOT NULL,
                "priceType" varchar(32) NOT NULL,
                "oldPrice" decimal(10,2),
                "newPrice" decimal(10,2) NOT NULL,
                "currency" varchar(3) NOT NULL DEFAULT 'USD',
                "effectiveDate" TIMESTAMP WITH TIME ZONE NOT NULL,
                "reason" varchar(512),
                "createdByUserId" varchar(32),
                CONSTRAINT "PK_pricing_history" PRIMARY KEY ("id")
            )
        `);
        
        await queryRunner.query(`CREATE INDEX "IDX_pricing_history_entityType" ON "pricing_history" ("entityType")`);
        await queryRunner.query(`CREATE INDEX "IDX_pricing_history_entityId" ON "pricing_history" ("entityId")`);
        await queryRunner.query(`CREATE INDEX "IDX_pricing_history_effectiveDate" ON "pricing_history" ("effectiveDate")`);
        
        await queryRunner.query(`
            ALTER TABLE "pricing_history" 
            ADD CONSTRAINT "FK_pricing_history_createdByUserId" 
            FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE SET NULL
        `);

        // 6. Create school_billing table for financial tracking
        await queryRunner.query(`
            CREATE TABLE "school_billing" (
                "id" varchar(32) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "schoolId" varchar(32) NOT NULL,
                "billingCycle" varchar(32) NOT NULL DEFAULT 'monthly',
                "status" varchar(32) NOT NULL DEFAULT 'active',
                "currentPeriodStart" TIMESTAMP WITH TIME ZONE NOT NULL,
                "currentPeriodEnd" TIMESTAMP WITH TIME ZONE NOT NULL,
                "studentCount" integer NOT NULL DEFAULT 0,
                "pricePerStudent" decimal(10,2) NOT NULL,
                "totalAmount" decimal(10,2) NOT NULL,
                "currency" varchar(3) NOT NULL DEFAULT 'USD',
                "stripeCustomerId" varchar(128),
                "stripeSubscriptionId" varchar(128),
                "lastPaymentDate" TIMESTAMP WITH TIME ZONE,
                "nextPaymentDate" TIMESTAMP WITH TIME ZONE,
                "paymentMethod" jsonb,
                "metadata" jsonb NOT NULL DEFAULT '{}',
                CONSTRAINT "PK_school_billing" PRIMARY KEY ("id")
            )
        `);
        
        await queryRunner.query(`CREATE INDEX "IDX_school_billing_schoolId" ON "school_billing" ("schoolId")`);
        await queryRunner.query(`CREATE INDEX "IDX_school_billing_status" ON "school_billing" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_school_billing_nextPaymentDate" ON "school_billing" ("nextPaymentDate")`);
        
        await queryRunner.query(`
            ALTER TABLE "school_billing" 
            ADD CONSTRAINT "FK_school_billing_schoolId" 
            FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE
        `);

        // 7. Create graduated_students table for alumni tracking
        await queryRunner.query(`
            CREATE TABLE "graduated_students" (
                "id" varchar(32) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "userId" varchar(32) NOT NULL,
                "schoolId" varchar(32) NOT NULL,
                "graduationDate" TIMESTAMP WITH TIME ZONE NOT NULL,
                "degree" varchar(256),
                "major" varchar(256),
                "gpa" decimal(3,2),
                "honors" varchar(128),
                "transcriptUrl" varchar(512),
                "verificationStatus" varchar(32) NOT NULL DEFAULT 'pending',
                "verifiedAt" TIMESTAMP WITH TIME ZONE,
                "verifiedByUserId" varchar(32),
                "alumniStatus" varchar(32) NOT NULL DEFAULT 'graduated',
                "lastContactDate" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_graduated_students" PRIMARY KEY ("id")
            )
        `);
        
        await queryRunner.query(`CREATE INDEX "IDX_graduated_students_userId" ON "graduated_students" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_graduated_students_schoolId" ON "graduated_students" ("schoolId")`);
        await queryRunner.query(`CREATE INDEX "IDX_graduated_students_graduationDate" ON "graduated_students" ("graduationDate")`);
        await queryRunner.query(`CREATE INDEX "IDX_graduated_students_verificationStatus" ON "graduated_students" ("verificationStatus")`);
        
        await queryRunner.query(`
            ALTER TABLE "graduated_students" 
            ADD CONSTRAINT "FK_graduated_students_userId" 
            FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
        `);
        
        await queryRunner.query(`
            ALTER TABLE "graduated_students" 
            ADD CONSTRAINT "FK_graduated_students_schoolId" 
            FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE
        `);
        
        await queryRunner.query(`
            ALTER TABLE "graduated_students" 
            ADD CONSTRAINT "FK_graduated_students_verifiedByUserId" 
            FOREIGN KEY ("verifiedByUserId") REFERENCES "user"("id") ON DELETE SET NULL
        `);

        // 8. Modify users table to include school-related fields
        await queryRunner.query(`
            ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "schoolId" varchar(32)
        `);
        
        await queryRunner.query(`
            ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "studentId" varchar(128)
        `);
        
        await queryRunner.query(`
            ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "graduationYear" integer
        `);
        
        await queryRunner.query(`
            ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "gradeLevel" varchar(32)
        `);
        
        await queryRunner.query(`
            ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "major" varchar(256)
        `);
        
        await queryRunner.query(`
            ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "enrollmentStatus" varchar(32) DEFAULT 'active'
        `);
        
        await queryRunner.query(`
            ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "isAlumni" boolean NOT NULL DEFAULT false
        `);

        // Add indexes for new user fields
        await queryRunner.query(`CREATE INDEX "IDX_user_schoolId" ON "user" ("schoolId")`);
        await queryRunner.query(`CREATE INDEX "IDX_user_graduationYear" ON "user" ("graduationYear")`);
        await queryRunner.query(`CREATE INDEX "IDX_user_enrollmentStatus" ON "user" ("enrollmentStatus")`);
        await queryRunner.query(`CREATE INDEX "IDX_user_isAlumni" ON "user" ("isAlumni")`);
        
        // Add foreign key constraint
        await queryRunner.query(`
            ALTER TABLE "user" 
            ADD CONSTRAINT "FK_user_schoolId" 
            FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE SET NULL
        `);

        // 9. Create stripe_customers table to link to schools instead of individual users
        await queryRunner.query(`
            CREATE TABLE "stripe_customers" (
                "id" varchar(32) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "stripeCustomerId" varchar(128) NOT NULL UNIQUE,
                "schoolId" varchar(32),
                "userId" varchar(32),
                "email" varchar(256) NOT NULL,
                "name" varchar(256),
                "customerType" varchar(32) NOT NULL DEFAULT 'individual',
                "billingAddress" jsonb,
                "taxInfo" jsonb,
                "metadata" jsonb NOT NULL DEFAULT '{}',
                "isActive" boolean NOT NULL DEFAULT true,
                CONSTRAINT "PK_stripe_customers" PRIMARY KEY ("id")
            )
        `);
        
        await queryRunner.query(`CREATE INDEX "IDX_stripe_customers_stripeCustomerId" ON "stripe_customers" ("stripeCustomerId")`);
        await queryRunner.query(`CREATE INDEX "IDX_stripe_customers_schoolId" ON "stripe_customers" ("schoolId")`);
        await queryRunner.query(`CREATE INDEX "IDX_stripe_customers_userId" ON "stripe_customers" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_stripe_customers_customerType" ON "stripe_customers" ("customerType")`);
        
        await queryRunner.query(`
            ALTER TABLE "stripe_customers" 
            ADD CONSTRAINT "FK_stripe_customers_schoolId" 
            FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE
        `);
        
        await queryRunner.query(`
            ALTER TABLE "stripe_customers" 
            ADD CONSTRAINT "FK_stripe_customers_userId" 
            FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
        `);

        console.log('School system foundation tables created successfully');
    }

    async down(queryRunner) {
        // Drop in reverse order to handle foreign key dependencies
        await queryRunner.query(`DROP TABLE IF EXISTS "stripe_customers"`);
        
        // Remove user table modifications
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "FK_user_schoolId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_schoolId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_graduationYear"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_enrollmentStatus"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_isAlumni"`);
        
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "schoolId"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "studentId"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "graduationYear"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "gradeLevel"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "major"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "enrollmentStatus"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "isAlumni"`);
        
        await queryRunner.query(`DROP TABLE IF EXISTS "graduated_students"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "school_billing"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "pricing_history"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "content_flags"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "campus_blocks"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "school_domains"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "schools"`);
        
        console.log('School system foundation tables dropped successfully');
    }
}
