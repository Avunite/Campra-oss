export class ChannelEnhancementsV11751583000000 {
    name = 'ChannelEnhancementsV11751583000000'

    async up(queryRunner) {
        console.log('Creating channel enhancement entities and extending Channel entity...');

        // Extend Channel entity with new privacy and flair settings fields
        await queryRunner.query(`
            ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "isPrivate" boolean NOT NULL DEFAULT false
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel"."isPrivate" IS 'Whether the channel is private (hidden from public listings).'
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_channel_isPrivate" ON "channel" ("isPrivate")`);

        await queryRunner.query(`
            ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "isInviteOnly" boolean NOT NULL DEFAULT false
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel"."isInviteOnly" IS 'Whether the channel is invite-only.'
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_channel_isInviteOnly" ON "channel" ("isInviteOnly")`);

        await queryRunner.query(`
            ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "allowInviteRequests" boolean NOT NULL DEFAULT false
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel"."allowInviteRequests" IS 'Whether the channel allows invite requests from non-members.'
        `);

        await queryRunner.query(`
            ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "schoolId" character varying(32)
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel"."schoolId" IS 'The ID of the school this channel belongs to.'
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_channel_schoolId" ON "channel" ("schoolId")`);

        await queryRunner.query(`
            ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "applicationFormId" character varying(32)
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel"."applicationFormId" IS 'The ID of the application form for this channel.'
        `);

        await queryRunner.query(`
            ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "requireApplicationForm" boolean NOT NULL DEFAULT false
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel"."requireApplicationForm" IS 'Whether an application form is required to join this channel.'
        `);

        await queryRunner.query(`
            ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "userFlairSettings" jsonb NOT NULL DEFAULT '{"enabled": false, "allowUserCreated": false, "allowUserAssignment": false}'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel"."userFlairSettings" IS 'User flair settings for this channel.'
        `);

        await queryRunner.query(`
            ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "postFlairSettings" jsonb NOT NULL DEFAULT '{"enabled": false, "required": false}'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel"."postFlairSettings" IS 'Post flair settings for this channel.'
        `);

        // Create ChannelRole table
        await queryRunner.query(`
            CREATE TABLE "channel_role" (
                "id" character varying(32) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "channelId" character varying(32) NOT NULL,
                "name" character varying(128) NOT NULL,
                "color" character varying(7) NOT NULL DEFAULT '#99aab5',
                "position" integer NOT NULL DEFAULT 0,
                "isDefault" boolean NOT NULL DEFAULT false,
                "isMentionable" boolean NOT NULL DEFAULT true,
                "createdBy" character varying(32),
                CONSTRAINT "PK_channel_role_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_channel_role_createdAt" ON "channel_role" ("createdAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_channel_role_channelId" ON "channel_role" ("channelId")`);
        await queryRunner.query(`CREATE INDEX "IDX_channel_role_position" ON "channel_role" ("position")`);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_role"."createdAt" IS 'The created date of the ChannelRole.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_role"."channelId" IS 'The channel ID.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_role"."name" IS 'The name of the role.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_role"."color" IS 'The color of the role in hex format.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_role"."position" IS 'The position of the role in the hierarchy (higher = more permissions).'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_role"."isDefault" IS 'Whether this is the default role for new members.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_role"."isMentionable" IS 'Whether this role is mentionable.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_role"."createdBy" IS 'The user who created this role.'
        `);

        // Create ChannelPermission table
        await queryRunner.query(`
            CREATE TABLE "channel_permission" (
                "id" character varying(32) NOT NULL,
                "roleId" character varying(32) NOT NULL,
                "permission" character varying(64) NOT NULL,
                "allow" boolean NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT "PK_channel_permission_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_channel_permission_roleId" ON "channel_permission" ("roleId")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_channel_permission_role_permission" ON "channel_permission" ("roleId", "permission")`);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_permission"."roleId" IS 'The role ID.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_permission"."permission" IS 'The permission name (e.g., VIEW_CHANNEL, POST_NOTES, etc.).'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_permission"."allow" IS 'Whether this permission is allowed (true) or denied (false).'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_permission"."createdAt" IS 'The created date of the ChannelPermission.'
        `);

        // Create ChannelMemberRole table
        await queryRunner.query(`
            CREATE TABLE "channel_member_role" (
                "id" character varying(32) NOT NULL,
                "channelId" character varying(32) NOT NULL,
                "userId" character varying(32) NOT NULL,
                "roleId" character varying(32) NOT NULL,
                "assignedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "assignedBy" character varying(32),
                CONSTRAINT "PK_channel_member_role_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_channel_member_role_channelId" ON "channel_member_role" ("channelId")`);
        await queryRunner.query(`CREATE INDEX "IDX_channel_member_role_userId" ON "channel_member_role" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_channel_member_role_roleId" ON "channel_member_role" ("roleId")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_channel_member_role_unique" ON "channel_member_role" ("channelId", "userId", "roleId")`);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_member_role"."channelId" IS 'The channel ID.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_member_role"."userId" IS 'The user ID.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_member_role"."roleId" IS 'The role ID.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_member_role"."assignedAt" IS 'The date when this role was assigned.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_member_role"."assignedBy" IS 'The user who assigned this role.'
        `);

        // Create ChannelUserFlair table
        await queryRunner.query(`
            CREATE TABLE "channel_user_flair" (
                "id" character varying(32) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "channelId" character varying(32) NOT NULL,
                "name" character varying(128) NOT NULL,
                "text" character varying(64) NOT NULL,
                "color" character varying(7) NOT NULL DEFAULT '#99aab5',
                "emoji" character varying(32),
                "createdBy" character varying(32) NOT NULL,
                "isModeratorOnly" boolean NOT NULL DEFAULT false,
                "isActive" boolean NOT NULL DEFAULT true,
                CONSTRAINT "PK_channel_user_flair_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_channel_user_flair_createdAt" ON "channel_user_flair" ("createdAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_channel_user_flair_channelId" ON "channel_user_flair" ("channelId")`);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_user_flair"."createdAt" IS 'The created date of the ChannelUserFlair.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_user_flair"."channelId" IS 'The channel ID.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_user_flair"."name" IS 'The name of the flair.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_user_flair"."text" IS 'The display text of the flair.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_user_flair"."color" IS 'The color of the flair in hex format.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_user_flair"."emoji" IS 'Optional emoji for the flair.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_user_flair"."createdBy" IS 'The user who created this flair.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_user_flair"."isModeratorOnly" IS 'Whether this flair can only be assigned by moderators.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_user_flair"."isActive" IS 'Whether this flair is currently active.'
        `);

        // Create ChannelPostFlair table
        await queryRunner.query(`
            CREATE TABLE "channel_post_flair" (
                "id" character varying(32) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "channelId" character varying(32) NOT NULL,
                "name" character varying(128) NOT NULL,
                "text" character varying(64) NOT NULL,
                "color" character varying(7) NOT NULL DEFAULT '#99aab5',
                "emoji" character varying(32),
                "position" integer NOT NULL DEFAULT 0,
                "createdBy" character varying(32) NOT NULL,
                "isActive" boolean NOT NULL DEFAULT true,
                CONSTRAINT "PK_channel_post_flair_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_channel_post_flair_createdAt" ON "channel_post_flair" ("createdAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_channel_post_flair_channelId" ON "channel_post_flair" ("channelId")`);
        await queryRunner.query(`CREATE INDEX "IDX_channel_post_flair_position" ON "channel_post_flair" ("position")`);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_post_flair"."createdAt" IS 'The created date of the ChannelPostFlair.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_post_flair"."channelId" IS 'The channel ID.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_post_flair"."name" IS 'The name of the flair.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_post_flair"."text" IS 'The display text of the flair.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_post_flair"."color" IS 'The color of the flair in hex format.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_post_flair"."emoji" IS 'Optional emoji for the flair.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_post_flair"."position" IS 'The position of the flair in the list.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_post_flair"."createdBy" IS 'The user who created this flair.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_post_flair"."isActive" IS 'Whether this flair is currently active.'
        `);

        // Create UserChannelFlair table
        await queryRunner.query(`
            CREATE TABLE "user_channel_flair" (
                "id" character varying(32) NOT NULL,
                "userId" character varying(32) NOT NULL,
                "channelId" character varying(32) NOT NULL,
                "flairId" character varying(32) NOT NULL,
                "customText" character varying(64),
                "assignedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "assignedBy" character varying(32),
                CONSTRAINT "PK_user_channel_flair_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_user_channel_flair_userId" ON "user_channel_flair" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_user_channel_flair_channelId" ON "user_channel_flair" ("channelId")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_user_channel_flair_unique" ON "user_channel_flair" ("userId", "channelId")`);
        await queryRunner.query(`
            COMMENT ON COLUMN "user_channel_flair"."userId" IS 'The user ID.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "user_channel_flair"."channelId" IS 'The channel ID.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "user_channel_flair"."flairId" IS 'The flair ID.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "user_channel_flair"."customText" IS 'Custom text for user-customized flairs.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "user_channel_flair"."assignedAt" IS 'The date when this flair was assigned.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "user_channel_flair"."assignedBy" IS 'The user who assigned this flair (null if self-assigned).'
        `);

        // Create NotePostFlair table
        await queryRunner.query(`
            CREATE TABLE "note_post_flair" (
                "id" character varying(32) NOT NULL,
                "noteId" character varying(32) NOT NULL,
                "flairId" character varying(32) NOT NULL,
                "assignedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "assignedBy" character varying(32) NOT NULL,
                CONSTRAINT "PK_note_post_flair_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_note_post_flair_noteId" ON "note_post_flair" ("noteId")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_note_post_flair_unique" ON "note_post_flair" ("noteId", "flairId")`);
        await queryRunner.query(`
            COMMENT ON COLUMN "note_post_flair"."noteId" IS 'The note ID.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "note_post_flair"."flairId" IS 'The flair ID.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "note_post_flair"."assignedAt" IS 'The date when this flair was assigned.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "note_post_flair"."assignedBy" IS 'The user who assigned this flair.'
        `);

        // Create ChannelInvitation table
        await queryRunner.query(`
            CREATE TABLE "channel_invitation" (
                "id" character varying(32) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "inviterId" character varying(32) NOT NULL,
                "inviteeId" character varying(32) NOT NULL,
                "channelId" character varying(32) NOT NULL,
                CONSTRAINT "PK_channel_invitation_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_channel_invitation_inviterId" ON "channel_invitation" ("inviterId")`);
        await queryRunner.query(`CREATE INDEX "IDX_channel_invitation_inviteeId" ON "channel_invitation" ("inviteeId")`);
        await queryRunner.query(`CREATE INDEX "IDX_channel_invitation_channelId" ON "channel_invitation" ("channelId")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_channel_invitation_unique" ON "channel_invitation" ("inviteeId", "channelId")`);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_invitation"."createdAt" IS 'The created date of the ChannelInvitation.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_invitation"."inviterId" IS 'The inviter user ID.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_invitation"."inviteeId" IS 'The invitee user ID.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_invitation"."channelId" IS 'The channel ID.'
        `);

        // Create ChannelInviteRequest table
        await queryRunner.query(`
            CREATE TABLE "channel_invite_request" (
                "id" character varying(32) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "requesterId" character varying(32) NOT NULL,
                "channelId" character varying(32) NOT NULL,
                "status" character varying(16) NOT NULL DEFAULT 'pending',
                "reviewedBy" character varying(32),
                "reviewedAt" TIMESTAMP WITH TIME ZONE,
                "message" character varying(512),
                CONSTRAINT "PK_channel_invite_request_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_channel_invite_request_requesterId" ON "channel_invite_request" ("requesterId")`);
        await queryRunner.query(`CREATE INDEX "IDX_channel_invite_request_channelId" ON "channel_invite_request" ("channelId")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_channel_invite_request_unique" ON "channel_invite_request" ("requesterId", "channelId")`);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_invite_request"."createdAt" IS 'The created date of the ChannelInviteRequest.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_invite_request"."requesterId" IS 'The requester user ID.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_invite_request"."channelId" IS 'The channel ID.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_invite_request"."status" IS 'The status of the invite request.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_invite_request"."reviewedBy" IS 'The user who reviewed this request.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_invite_request"."reviewedAt" IS 'The date when this request was reviewed.'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "channel_invite_request"."message" IS 'Optional message from the requester.'
        `);

        // Add channelInvitationId to notification table
        await queryRunner.query(`
            ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS "channelInvitationId" character varying(32)
        `);

        // Add foreign key constraints
        await queryRunner.query(`
            ALTER TABLE "channel_role" ADD CONSTRAINT "FK_channel_role_channelId" 
            FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "channel_role" ADD CONSTRAINT "FK_channel_role_createdBy" 
            FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "channel_permission" ADD CONSTRAINT "FK_channel_permission_roleId" 
            FOREIGN KEY ("roleId") REFERENCES "channel_role"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "channel_member_role" ADD CONSTRAINT "FK_channel_member_role_channelId" 
            FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "channel_member_role" ADD CONSTRAINT "FK_channel_member_role_userId" 
            FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "channel_member_role" ADD CONSTRAINT "FK_channel_member_role_roleId" 
            FOREIGN KEY ("roleId") REFERENCES "channel_role"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "channel_member_role" ADD CONSTRAINT "FK_channel_member_role_assignedBy" 
            FOREIGN KEY ("assignedBy") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "channel_user_flair" ADD CONSTRAINT "FK_channel_user_flair_channelId" 
            FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "channel_user_flair" ADD CONSTRAINT "FK_channel_user_flair_createdBy" 
            FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "channel_post_flair" ADD CONSTRAINT "FK_channel_post_flair_channelId" 
            FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "channel_post_flair" ADD CONSTRAINT "FK_channel_post_flair_createdBy" 
            FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "user_channel_flair" ADD CONSTRAINT "FK_user_channel_flair_userId" 
            FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "user_channel_flair" ADD CONSTRAINT "FK_user_channel_flair_channelId" 
            FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "user_channel_flair" ADD CONSTRAINT "FK_user_channel_flair_flairId" 
            FOREIGN KEY ("flairId") REFERENCES "channel_user_flair"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "user_channel_flair" ADD CONSTRAINT "FK_user_channel_flair_assignedBy" 
            FOREIGN KEY ("assignedBy") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "note_post_flair" ADD CONSTRAINT "FK_note_post_flair_noteId" 
            FOREIGN KEY ("noteId") REFERENCES "note"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "note_post_flair" ADD CONSTRAINT "FK_note_post_flair_flairId" 
            FOREIGN KEY ("flairId") REFERENCES "channel_post_flair"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "note_post_flair" ADD CONSTRAINT "FK_note_post_flair_assignedBy" 
            FOREIGN KEY ("assignedBy") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "channel_invitation" ADD CONSTRAINT "FK_channel_invitation_inviterId" 
            FOREIGN KEY ("inviterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "channel_invitation" ADD CONSTRAINT "FK_channel_invitation_inviteeId" 
            FOREIGN KEY ("inviteeId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "channel_invitation" ADD CONSTRAINT "FK_channel_invitation_channelId" 
            FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "channel_invite_request" ADD CONSTRAINT "FK_channel_invite_request_requesterId" 
            FOREIGN KEY ("requesterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "channel_invite_request" ADD CONSTRAINT "FK_channel_invite_request_channelId" 
            FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "channel_invite_request" ADD CONSTRAINT "FK_channel_invite_request_reviewedBy" 
            FOREIGN KEY ("reviewedBy") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "notification" ADD CONSTRAINT "FK_notification_channelInvitationId" 
            FOREIGN KEY ("channelInvitationId") REFERENCES "channel_invitation"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        console.log('✅ Created all channel enhancement entities and extended Channel entity');
    }

    async down(queryRunner) {
        // Remove foreign key constraints
        await queryRunner.query(`ALTER TABLE "notification" DROP CONSTRAINT IF EXISTS "FK_notification_channelInvitationId"`);
        await queryRunner.query(`ALTER TABLE "channel_invite_request" DROP CONSTRAINT IF EXISTS "FK_channel_invite_request_reviewedBy"`);
        await queryRunner.query(`ALTER TABLE "channel_invite_request" DROP CONSTRAINT IF EXISTS "FK_channel_invite_request_channelId"`);
        await queryRunner.query(`ALTER TABLE "channel_invite_request" DROP CONSTRAINT IF EXISTS "FK_channel_invite_request_requesterId"`);
        await queryRunner.query(`ALTER TABLE "channel_invitation" DROP CONSTRAINT IF EXISTS "FK_channel_invitation_channelId"`);
        await queryRunner.query(`ALTER TABLE "channel_invitation" DROP CONSTRAINT IF EXISTS "FK_channel_invitation_inviteeId"`);
        await queryRunner.query(`ALTER TABLE "channel_invitation" DROP CONSTRAINT IF EXISTS "FK_channel_invitation_inviterId"`);
        await queryRunner.query(`ALTER TABLE "note_post_flair" DROP CONSTRAINT IF EXISTS "FK_note_post_flair_assignedBy"`);
        await queryRunner.query(`ALTER TABLE "note_post_flair" DROP CONSTRAINT IF EXISTS "FK_note_post_flair_flairId"`);
        await queryRunner.query(`ALTER TABLE "note_post_flair" DROP CONSTRAINT IF EXISTS "FK_note_post_flair_noteId"`);
        await queryRunner.query(`ALTER TABLE "user_channel_flair" DROP CONSTRAINT IF EXISTS "FK_user_channel_flair_assignedBy"`);
        await queryRunner.query(`ALTER TABLE "user_channel_flair" DROP CONSTRAINT IF EXISTS "FK_user_channel_flair_flairId"`);
        await queryRunner.query(`ALTER TABLE "user_channel_flair" DROP CONSTRAINT IF EXISTS "FK_user_channel_flair_channelId"`);
        await queryRunner.query(`ALTER TABLE "user_channel_flair" DROP CONSTRAINT IF EXISTS "FK_user_channel_flair_userId"`);
        await queryRunner.query(`ALTER TABLE "channel_post_flair" DROP CONSTRAINT IF EXISTS "FK_channel_post_flair_createdBy"`);
        await queryRunner.query(`ALTER TABLE "channel_post_flair" DROP CONSTRAINT IF EXISTS "FK_channel_post_flair_channelId"`);
        await queryRunner.query(`ALTER TABLE "channel_user_flair" DROP CONSTRAINT IF EXISTS "FK_channel_user_flair_createdBy"`);
        await queryRunner.query(`ALTER TABLE "channel_user_flair" DROP CONSTRAINT IF EXISTS "FK_channel_user_flair_channelId"`);
        await queryRunner.query(`ALTER TABLE "channel_member_role" DROP CONSTRAINT IF EXISTS "FK_channel_member_role_assignedBy"`);
        await queryRunner.query(`ALTER TABLE "channel_member_role" DROP CONSTRAINT IF EXISTS "FK_channel_member_role_roleId"`);
        await queryRunner.query(`ALTER TABLE "channel_member_role" DROP CONSTRAINT IF EXISTS "FK_channel_member_role_userId"`);
        await queryRunner.query(`ALTER TABLE "channel_member_role" DROP CONSTRAINT IF EXISTS "FK_channel_member_role_channelId"`);
        await queryRunner.query(`ALTER TABLE "channel_permission" DROP CONSTRAINT IF EXISTS "FK_channel_permission_roleId"`);
        await queryRunner.query(`ALTER TABLE "channel_role" DROP CONSTRAINT IF EXISTS "FK_channel_role_createdBy"`);
        await queryRunner.query(`ALTER TABLE "channel_role" DROP CONSTRAINT IF EXISTS "FK_channel_role_channelId"`);

        // Drop tables
        await queryRunner.query(`DROP TABLE IF EXISTS "channel_invite_request"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "channel_invitation"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "note_post_flair"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "user_channel_flair"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "channel_post_flair"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "channel_user_flair"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "channel_member_role"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "channel_permission"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "channel_role"`);

        // Remove columns from notification table
        await queryRunner.query(`ALTER TABLE "notification" DROP COLUMN IF EXISTS "channelInvitationId"`);

        // Remove indexes from channel table
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_channel_schoolId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_channel_isInviteOnly"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_channel_isPrivate"`);

        // Remove columns from channel table
        await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN IF EXISTS "postFlairSettings"`);
        await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN IF EXISTS "userFlairSettings"`);
        await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN IF EXISTS "requireApplicationForm"`);
        await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN IF EXISTS "applicationFormId"`);
        await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN IF EXISTS "schoolId"`);
        await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN IF EXISTS "allowInviteRequests"`);
        await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN IF EXISTS "isInviteOnly"`);
        await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN IF EXISTS "isPrivate"`);

        console.log('⏪ Removed all channel enhancement entities and reverted Channel entity');
    }
}