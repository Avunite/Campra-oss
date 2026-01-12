export class AddChannelModerationColumns1749802000000 {
    name = 'AddChannelModerationColumns1749802000000'

    async up(queryRunner) {
        // Add moderators column to channel table if it doesn't exist
        const moderatorsExists = await queryRunner.hasColumn('channel', 'moderators');
        if (!moderatorsExists) {
            await queryRunner.query(`ALTER TABLE "channel" ADD "moderators" jsonb NOT NULL DEFAULT '[]'`);
        }

        // Add admins column to channel table if it doesn't exist
        const adminsExists = await queryRunner.hasColumn('channel', 'admins');
        if (!adminsExists) {
            await queryRunner.query(`ALTER TABLE "channel" ADD "admins" jsonb NOT NULL DEFAULT '[]'`);
        }

        // Add archive column to channel table if it doesn't exist
        const archiveExists = await queryRunner.hasColumn('channel', 'archive');
        if (!archiveExists) {
            await queryRunner.query(`ALTER TABLE "channel" ADD "archive" boolean NOT NULL DEFAULT false`);
        }

        // Add banned column to channel table if it doesn't exist
        const bannedExists = await queryRunner.hasColumn('channel', 'banned');
        if (!bannedExists) {
            await queryRunner.query(`ALTER TABLE "channel" ADD "banned" jsonb NOT NULL DEFAULT '[]'`);
        }
    }

    async down(queryRunner) {
        // Remove banned column if it exists
        const bannedExists = await queryRunner.hasColumn('channel', 'banned');
        if (bannedExists) {
            await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "banned"`);
        }

        // Remove archive column if it exists
        const archiveExists = await queryRunner.hasColumn('channel', 'archive');
        if (archiveExists) {
            await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "archive"`);
        }

        // Remove admins column if it exists
        const adminsExists = await queryRunner.hasColumn('channel', 'admins');
        if (adminsExists) {
            await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "admins"`);
        }

        // Remove moderators column if it exists
        const moderatorsExists = await queryRunner.hasColumn('channel', 'moderators');
        if (moderatorsExists) {
            await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "moderators"`);
        }
    }
}
