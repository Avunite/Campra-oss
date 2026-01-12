export class ContentModerationSetup1000000040001 {
    name = 'ContentModerationSetup1000000040001'
    
    async up(queryRunner) {
        // 1. Add iffy.com integration configuration to meta table
        await queryRunner.query(`
            ALTER TABLE "meta" ADD COLUMN IF NOT EXISTS "iffyApiKey" varchar(128)
        `);
        
        await queryRunner.query(`
            ALTER TABLE "meta" ADD COLUMN IF NOT EXISTS "iffyApiEndpoint" varchar(512) DEFAULT 'https://api.iffy.com/v1'
        `);
        
        await queryRunner.query(`
            ALTER TABLE "meta" ADD COLUMN IF NOT EXISTS "enableIffyModeration" boolean NOT NULL DEFAULT false
        `);
        
        await queryRunner.query(`
            ALTER TABLE "meta" ADD COLUMN IF NOT EXISTS "iffyModerationThreshold" decimal(3,2) DEFAULT 0.7
        `);
        
        await queryRunner.query(`
            ALTER TABLE "meta" ADD COLUMN IF NOT EXISTS "iffyRateLimit" integer DEFAULT 1000
        `);
        
        await queryRunner.query(`
            ALTER TABLE "meta" ADD COLUMN IF NOT EXISTS "iffySettings" jsonb NOT NULL DEFAULT '{}'
        `);

        // 2. Create moderation_actions table for audit trail
        await queryRunner.query(`
            CREATE TABLE "moderation_actions" (
                "id" varchar(32) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "contentType" varchar(32) NOT NULL,
                "contentId" varchar(32) NOT NULL,
                "actionType" varchar(32) NOT NULL,
                "reason" varchar(512),
                "moderatorId" varchar(32),
                "isAutomated" boolean NOT NULL DEFAULT false,
                "severity" varchar(32) NOT NULL DEFAULT 'medium',
                "metadata" jsonb NOT NULL DEFAULT '{}',
                "reversedAt" TIMESTAMP WITH TIME ZONE,
                "reversedById" varchar(32),
                "reversalReason" varchar(512),
                CONSTRAINT "PK_moderation_actions" PRIMARY KEY ("id")
            )
        `);
        
        await queryRunner.query(`CREATE INDEX "IDX_moderation_actions_contentType" ON "moderation_actions" ("contentType")`);
        await queryRunner.query(`CREATE INDEX "IDX_moderation_actions_contentId" ON "moderation_actions" ("contentId")`);
        await queryRunner.query(`CREATE INDEX "IDX_moderation_actions_actionType" ON "moderation_actions" ("actionType")`);
        await queryRunner.query(`CREATE INDEX "IDX_moderation_actions_moderatorId" ON "moderation_actions" ("moderatorId")`);
        await queryRunner.query(`CREATE INDEX "IDX_moderation_actions_isAutomated" ON "moderation_actions" ("isAutomated")`);
        await queryRunner.query(`CREATE INDEX "IDX_moderation_actions_severity" ON "moderation_actions" ("severity")`);
        
        await queryRunner.query(`
            ALTER TABLE "moderation_actions" 
            ADD CONSTRAINT "FK_moderation_actions_moderatorId" 
            FOREIGN KEY ("moderatorId") REFERENCES "user"("id") ON DELETE SET NULL
        `);
        
        await queryRunner.query(`
            ALTER TABLE "moderation_actions" 
            ADD CONSTRAINT "FK_moderation_actions_reversedById" 
            FOREIGN KEY ("reversedById") REFERENCES "user"("id") ON DELETE SET NULL
        `);

        // 3. Create moderation_escalations table for workflow management
        await queryRunner.query(`
            CREATE TABLE "moderation_escalations" (
                "id" varchar(32) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "contentFlagId" varchar(32) NOT NULL,
                "escalationLevel" integer NOT NULL DEFAULT 1,
                "status" varchar(32) NOT NULL DEFAULT 'pending',
                "assignedToId" varchar(32),
                "priority" varchar(32) NOT NULL DEFAULT 'medium',
                "dueDate" TIMESTAMP WITH TIME ZONE,
                "resolvedAt" TIMESTAMP WITH TIME ZONE,
                "resolution" varchar(512),
                "metadata" jsonb NOT NULL DEFAULT '{}',
                CONSTRAINT "PK_moderation_escalations" PRIMARY KEY ("id")
            )
        `);
        
        await queryRunner.query(`CREATE INDEX "IDX_moderation_escalations_contentFlagId" ON "moderation_escalations" ("contentFlagId")`);
        await queryRunner.query(`CREATE INDEX "IDX_moderation_escalations_status" ON "moderation_escalations" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_moderation_escalations_assignedToId" ON "moderation_escalations" ("assignedToId")`);
        await queryRunner.query(`CREATE INDEX "IDX_moderation_escalations_priority" ON "moderation_escalations" ("priority")`);
        await queryRunner.query(`CREATE INDEX "IDX_moderation_escalations_dueDate" ON "moderation_escalations" ("dueDate")`);
        
        await queryRunner.query(`
            ALTER TABLE "moderation_escalations" 
            ADD CONSTRAINT "FK_moderation_escalations_contentFlagId" 
            FOREIGN KEY ("contentFlagId") REFERENCES "content_flags"("id") ON DELETE CASCADE
        `);
        
        await queryRunner.query(`
            ALTER TABLE "moderation_escalations" 
            ADD CONSTRAINT "FK_moderation_escalations_assignedToId" 
            FOREIGN KEY ("assignedToId") REFERENCES "user"("id") ON DELETE SET NULL
        `);

        // 4. Create moderation_rules table for automated policy enforcement
        await queryRunner.query(`
            CREATE TABLE "moderation_rules" (
                "id" varchar(32) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "name" varchar(256) NOT NULL,
                "description" varchar(512),
                "contentType" varchar(32) NOT NULL,
                "flagType" varchar(32) NOT NULL,
                "confidenceThreshold" decimal(3,2) NOT NULL DEFAULT 0.8,
                "action" varchar(32) NOT NULL,
                "isActive" boolean NOT NULL DEFAULT true,
                "schoolId" varchar(32),
                "conditions" jsonb NOT NULL DEFAULT '{}',
                "metadata" jsonb NOT NULL DEFAULT '{}',
                "createdById" varchar(32),
                CONSTRAINT "PK_moderation_rules" PRIMARY KEY ("id")
            )
        `);
        
        await queryRunner.query(`CREATE INDEX "IDX_moderation_rules_contentType" ON "moderation_rules" ("contentType")`);
        await queryRunner.query(`CREATE INDEX "IDX_moderation_rules_flagType" ON "moderation_rules" ("flagType")`);
        await queryRunner.query(`CREATE INDEX "IDX_moderation_rules_isActive" ON "moderation_rules" ("isActive")`);
        await queryRunner.query(`CREATE INDEX "IDX_moderation_rules_schoolId" ON "moderation_rules" ("schoolId")`);
        
        await queryRunner.query(`
            ALTER TABLE "moderation_rules" 
            ADD CONSTRAINT "FK_moderation_rules_schoolId" 
            FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE
        `);
        
        await queryRunner.query(`
            ALTER TABLE "moderation_rules" 
            ADD CONSTRAINT "FK_moderation_rules_createdById" 
            FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL
        `);

        // 5. Create iffy_api_logs table for rate limiting and monitoring
        await queryRunner.query(`
            CREATE TABLE "iffy_api_logs" (
                "id" varchar(32) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "endpoint" varchar(256) NOT NULL,
                "method" varchar(16) NOT NULL,
                "statusCode" integer,
                "responseTime" integer,
                "requestSize" integer,
                "responseSize" integer,
                "rateLimitRemaining" integer,
                "rateLimitReset" TIMESTAMP WITH TIME ZONE,
                "errorMessage" varchar(512),
                "metadata" jsonb NOT NULL DEFAULT '{}',
                CONSTRAINT "PK_iffy_api_logs" PRIMARY KEY ("id")
            )
        `);
        
        await queryRunner.query(`CREATE INDEX "IDX_iffy_api_logs_createdAt" ON "iffy_api_logs" ("createdAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_iffy_api_logs_endpoint" ON "iffy_api_logs" ("endpoint")`);
        await queryRunner.query(`CREATE INDEX "IDX_iffy_api_logs_statusCode" ON "iffy_api_logs" ("statusCode")`);

        // 6. Add indexes to content_flags for efficient querying
        await queryRunner.query(`CREATE INDEX "IDX_content_flags_createdAt" ON "content_flags" ("createdAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_content_flags_confidence" ON "content_flags" ("confidence")`);
        await queryRunner.query(`CREATE INDEX "IDX_content_flags_reviewedAt" ON "content_flags" ("reviewedAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_content_flags_composite" ON "content_flags" ("contentType", "flagType", "status")`);

        // 7. Create default moderation rules for common scenarios
        await queryRunner.query(`
            INSERT INTO "moderation_rules" (
                "id", "createdAt", "updatedAt", "name", "description", 
                "contentType", "flagType", "confidenceThreshold", "action", 
                "conditions", "metadata"
            ) VALUES 
            (
                '${generateId()}', NOW(), NOW(), 
                'High Confidence Harassment Auto-Remove', 
                'Automatically remove content flagged as harassment with high confidence',
                'note', 'harassment', 0.9, 'remove',
                '{"autoEscalate": true}', 
                '{"priority": "high", "notifyModerators": true}'
            ),
            (
                '${generateId()}', NOW(), NOW(),
                'Moderate Hate Speech Flag', 
                'Flag hate speech for manual review',
                'note', 'hate_speech', 0.7, 'flag',
                '{"requireHumanReview": true}', 
                '{"priority": "high", "escalationLevel": 2}'
            ),
            (
                '${generateId()}', NOW(), NOW(),
                'Spam Detection Auto-Hide', 
                'Automatically hide content flagged as spam',
                'note', 'spam', 0.8, 'hide',
                '{"temporaryAction": true, "reviewPeriod": "24h"}', 
                '{"priority": "medium", "autoReview": true}'
            )
        `);

        console.log('Content moderation setup completed successfully');
    }

    async down(queryRunner) {
        // Drop tables in reverse order
        await queryRunner.query(`DROP TABLE IF EXISTS "iffy_api_logs"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "moderation_rules"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "moderation_escalations"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "moderation_actions"`);
        
        // Remove meta table columns
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "iffyApiKey"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "iffyApiEndpoint"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "enableIffyModeration"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "iffyModerationThreshold"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "iffyRateLimit"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "iffySettings"`);
        
        // Remove indexes from content_flags
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_content_flags_createdAt"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_content_flags_confidence"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_content_flags_reviewedAt"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_content_flags_composite"`);
        
        console.log('Content moderation setup rolled back successfully');
    }
}

// Helper function to generate IDs (you may need to import this from your existing ID generation utility)
function generateId() {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 16; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}
