export class messagingReplyAndReactions1748495834000 {
    name = 'messagingReplyAndReactions1748495834000'

    async up(queryRunner) {
        // Add reply functionality - reference to parent message
        await queryRunner.query(`
            ALTER TABLE "messaging_message" 
            ADD COLUMN "replyId" varchar NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "messaging_message" 
            ADD CONSTRAINT "FK_messaging_message_replyId" 
            FOREIGN KEY ("replyId") REFERENCES "messaging_message"("id") 
            ON DELETE CASCADE
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_messaging_message_replyId" 
            ON "messaging_message" ("replyId")
        `);

        // Create messaging message reactions table
        await queryRunner.query(`
            CREATE TABLE "messaging_message_reaction" (
                "id" varchar NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "userId" varchar NOT NULL,
                "messageId" varchar NOT NULL,
                "reaction" varchar(256) NOT NULL,
                CONSTRAINT "PK_messaging_message_reaction" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_messaging_message_reaction_user_message" UNIQUE ("userId", "messageId", "reaction")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "messaging_message_reaction" 
            ADD CONSTRAINT "FK_messaging_message_reaction_userId" 
            FOREIGN KEY ("userId") REFERENCES "user"("id") 
            ON DELETE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE "messaging_message_reaction" 
            ADD CONSTRAINT "FK_messaging_message_reaction_messageId" 
            FOREIGN KEY ("messageId") REFERENCES "messaging_message"("id") 
            ON DELETE CASCADE
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_messaging_message_reaction_userId" 
            ON "messaging_message_reaction" ("userId")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_messaging_message_reaction_messageId" 
            ON "messaging_message_reaction" ("messageId")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_messaging_message_reaction_reaction" 
            ON "messaging_message_reaction" ("reaction")
        `);

        // Add reaction count cache to messaging message
        await queryRunner.query(`
            ALTER TABLE "messaging_message" 
            ADD COLUMN "reactionCounts" jsonb DEFAULT '{}'::jsonb
        `);

        // Add isDeleted flag for soft deletes
        await queryRunner.query(`
            ALTER TABLE "messaging_message" 
            ADD COLUMN "isDeleted" boolean NOT NULL DEFAULT false
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_messaging_message_isDeleted" 
            ON "messaging_message" ("isDeleted")
        `);
    }

    async down(queryRunner) {
        // Drop indexes and constraints
        await queryRunner.query(`DROP INDEX "IDX_messaging_message_isDeleted"`);
        await queryRunner.query(`ALTER TABLE "messaging_message" DROP COLUMN "isDeleted"`);
        
        await queryRunner.query(`ALTER TABLE "messaging_message" DROP COLUMN "reactionCounts"`);
        
        await queryRunner.query(`DROP INDEX "IDX_messaging_message_reaction_reaction"`);
        await queryRunner.query(`DROP INDEX "IDX_messaging_message_reaction_messageId"`);
        await queryRunner.query(`DROP INDEX "IDX_messaging_message_reaction_userId"`);
        
        await queryRunner.query(`ALTER TABLE "messaging_message_reaction" DROP CONSTRAINT "FK_messaging_message_reaction_messageId"`);
        await queryRunner.query(`ALTER TABLE "messaging_message_reaction" DROP CONSTRAINT "FK_messaging_message_reaction_userId"`);
        
        await queryRunner.query(`DROP TABLE "messaging_message_reaction"`);
        
        await queryRunner.query(`DROP INDEX "IDX_messaging_message_replyId"`);
        await queryRunner.query(`ALTER TABLE "messaging_message" DROP CONSTRAINT "FK_messaging_message_replyId"`);
        await queryRunner.query(`ALTER TABLE "messaging_message" DROP COLUMN "replyId"`);
    }
}
