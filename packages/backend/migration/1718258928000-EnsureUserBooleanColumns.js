export class EnsureUserBooleanColumns1718258928000 {
    name = 'EnsureUserBooleanColumns1718258928000'

    async up(queryRunner) {
        // Add missing boolean columns to user table if they don't exist
        
        // Check and add hideOnlineStatus
        const hideOnlineStatusExists = await queryRunner.hasColumn('user', 'hideOnlineStatus');
        if (!hideOnlineStatusExists) {
            await queryRunner.query(`ALTER TABLE "user" ADD "hideOnlineStatus" boolean NOT NULL DEFAULT false`);
        }

        // Check and add isSuspended
        const isSuspendedExists = await queryRunner.hasColumn('user', 'isSuspended');
        if (!isSuspendedExists) {
            await queryRunner.query(`ALTER TABLE "user" ADD "isSuspended" boolean NOT NULL DEFAULT false`);
        }

        // Check and add isSilenced
        const isSilencedExists = await queryRunner.hasColumn('user', 'isSilenced');
        if (!isSilencedExists) {
            await queryRunner.query(`ALTER TABLE "user" ADD "isSilenced" boolean NOT NULL DEFAULT false`);
        }

        // Check and add isLocked
        const isLockedExists = await queryRunner.hasColumn('user', 'isLocked');
        if (!isLockedExists) {
            await queryRunner.query(`ALTER TABLE "user" ADD "isLocked" boolean NOT NULL DEFAULT false`);
        }

        // Check and add isBot
        const isBotExists = await queryRunner.hasColumn('user', 'isBot');
        if (!isBotExists) {
            await queryRunner.query(`ALTER TABLE "user" ADD "isBot" boolean NOT NULL DEFAULT false`);
        }

        // Check and add isStaff
        const isStaffExists = await queryRunner.hasColumn('user', 'isStaff');
        if (!isStaffExists) {
            await queryRunner.query(`ALTER TABLE "user" ADD "isStaff" boolean NOT NULL DEFAULT false`);
        }

        // Check and add isTranslator
        const isTranslatorExists = await queryRunner.hasColumn('user', 'isTranslator');
        if (!isTranslatorExists) {
            await queryRunner.query(`ALTER TABLE "user" ADD "isTranslator" boolean NOT NULL DEFAULT false`);
        }

        // Check and add hasAlgoBeta
        const hasAlgoBetaExists = await queryRunner.hasColumn('user', 'hasAlgoBeta');
        if (!hasAlgoBetaExists) {
            await queryRunner.query(`ALTER TABLE "user" ADD "hasAlgoBeta" boolean NOT NULL DEFAULT false`);
        }

        // Check and add isOG
        const isOGExists = await queryRunner.hasColumn('user', 'isOG');
        if (!isOGExists) {
            await queryRunner.query(`ALTER TABLE "user" ADD "isOG" boolean NOT NULL DEFAULT false`);
        }

        // Check and add isCat
        const isCatExists = await queryRunner.hasColumn('user', 'isCat');
        if (!isCatExists) {
            await queryRunner.query(`ALTER TABLE "user" ADD "isCat" boolean NOT NULL DEFAULT false`);
        }

        // Check and add isAdmin
        const isAdminExists = await queryRunner.hasColumn('user', 'isAdmin');
        if (!isAdminExists) {
            await queryRunner.query(`ALTER TABLE "user" ADD "isAdmin" boolean NOT NULL DEFAULT false`);
        }

        // Check and add isModerator
        const isModeratorExists = await queryRunner.hasColumn('user', 'isModerator');
        if (!isModeratorExists) {
            await queryRunner.query(`ALTER TABLE "user" ADD "isModerator" boolean NOT NULL DEFAULT false`);
        }

        // Check and add isExplorable
        const isExplorableExists = await queryRunner.hasColumn('user', 'isExplorable');
        if (!isExplorableExists) {
            await queryRunner.query(`ALTER TABLE "user" ADD "isExplorable" boolean NOT NULL DEFAULT true`);
            await queryRunner.query(`CREATE INDEX "IDX_d5a1b83c7e5a6b6c5f5c5d5e5f" ON "user" ("isExplorable")`);
        }

        // Check and add isDeleted
        const isDeletedExists = await queryRunner.hasColumn('user', 'isDeleted');
        if (!isDeletedExists) {
            await queryRunner.query(`ALTER TABLE "user" ADD "isDeleted" boolean NOT NULL DEFAULT false`);
        }

        // Check and add showTimelineReplies
        const showTimelineRepliesExists = await queryRunner.hasColumn('user', 'showTimelineReplies');
        if (!showTimelineRepliesExists) {
            await queryRunner.query(`ALTER TABLE "user" ADD "showTimelineReplies" boolean NOT NULL DEFAULT false`);
        }

        // Check and add isAlumni
        const isAlumniExists = await queryRunner.hasColumn('user', 'isAlumni');
        if (!isAlumniExists) {
            await queryRunner.query(`ALTER TABLE "user" ADD "isAlumni" boolean NOT NULL DEFAULT false`);
            await queryRunner.query(`CREATE INDEX "IDX_user_isAlumni" ON "user" ("isAlumni")`);
        }

        // Check and add stripe_user array column
        const stripeUserExists = await queryRunner.hasColumn('user', 'stripe_user');
        if (!stripeUserExists) {
            await queryRunner.query(`ALTER TABLE "user" ADD "stripe_user" character varying(128) array NOT NULL DEFAULT '{}'`);
        }

        // Check and add subscriptionEndDate
        const subscriptionEndDateExists = await queryRunner.hasColumn('user', 'subscriptionEndDate');
        if (!subscriptionEndDateExists) {
            await queryRunner.query(`ALTER TABLE "user" ADD "subscriptionEndDate" TIMESTAMP WITH TIME ZONE`);
        }
    }

    async down(queryRunner) {
        // Remove the columns if they exist
        
        const hideOnlineStatusExists = await queryRunner.hasColumn('user', 'hideOnlineStatus');
        if (hideOnlineStatusExists) {
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "hideOnlineStatus"`);
        }

        const isSuspendedExists = await queryRunner.hasColumn('user', 'isSuspended');
        if (isSuspendedExists) {
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isSuspended"`);
        }

        const isSilencedExists = await queryRunner.hasColumn('user', 'isSilenced');
        if (isSilencedExists) {
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isSilenced"`);
        }

        const isLockedExists = await queryRunner.hasColumn('user', 'isLocked');
        if (isLockedExists) {
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isLocked"`);
        }

        const isBotExists = await queryRunner.hasColumn('user', 'isBot');
        if (isBotExists) {
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isBot"`);
        }

        const isStaffExists = await queryRunner.hasColumn('user', 'isStaff');
        if (isStaffExists) {
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isStaff"`);
        }

        const isTranslatorExists = await queryRunner.hasColumn('user', 'isTranslator');
        if (isTranslatorExists) {
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isTranslator"`);
        }

        const hasAlgoBetaExists = await queryRunner.hasColumn('user', 'hasAlgoBeta');
        if (hasAlgoBetaExists) {
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "hasAlgoBeta"`);
        }

        const isOGExists = await queryRunner.hasColumn('user', 'isOG');
        if (isOGExists) {
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isOG"`);
        }

        const isCatExists = await queryRunner.hasColumn('user', 'isCat');
        if (isCatExists) {
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isCat"`);
        }

        const isAdminExists = await queryRunner.hasColumn('user', 'isAdmin');
        if (isAdminExists) {
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isAdmin"`);
        }

        const isModeratorExists = await queryRunner.hasColumn('user', 'isModerator');
        if (isModeratorExists) {
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isModerator"`);
        }

        const isExplorableExists = await queryRunner.hasColumn('user', 'isExplorable');
        if (isExplorableExists) {
            await queryRunner.query(`DROP INDEX "IDX_d5a1b83c7e5a6b6c5f5c5d5e5f"`);
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isExplorable"`);
        }

        const isDeletedExists = await queryRunner.hasColumn('user', 'isDeleted');
        if (isDeletedExists) {
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isDeleted"`);
        }

        const showTimelineRepliesExists = await queryRunner.hasColumn('user', 'showTimelineReplies');
        if (showTimelineRepliesExists) {
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "showTimelineReplies"`);
        }

        const isAlumniExists = await queryRunner.hasColumn('user', 'isAlumni');
        if (isAlumniExists) {
            await queryRunner.query(`DROP INDEX "IDX_user_isAlumni"`);
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isAlumni"`);
        }
    }
}
