import { db } from '@/db/postgre.js';
import { MessagingMessage } from '@/models/entities/messaging-message.js';
import { Users, DriveFiles, UserGroups, MessagingMessageReactions } from '../index.js';
import { Packed } from '@/misc/schema.js';
import { User } from '@/models/entities/user.js';

export const MessagingMessageRepository = db.getRepository(MessagingMessage).extend({
	async pack(
		src: MessagingMessage['id'] | MessagingMessage,
		me?: { id: User['id'] } | null | undefined,
		options?: {
			populateRecipient?: boolean,
			populateGroup?: boolean,
		}
	): Promise<Packed<'MessagingMessage'>> {
		const opts = options || {
			populateRecipient: true,
			populateGroup: true,
		};

		const message = typeof src === 'object' ? src : await this.findOneByOrFail({ id: src });

		// Get user's reactions to this message
		let userReactions: string[] = [];
		if (me) {
			const reactions = await MessagingMessageReactions.findBy({
				messageId: message.id,
				userId: me.id,
			});
			userReactions = reactions.map(r => r.reaction);
		}

		return {
			id: message.id,
			createdAt: message.createdAt.toISOString(),
			text: message.text,
			userId: message.userId,
			user: await Users.pack(message.user || message.userId, me),
			recipientId: message.recipientId,
			recipient: message.recipientId && opts.populateRecipient ? await Users.pack(message.recipient || message.recipientId, me) : undefined,
			groupId: message.groupId,
			group: message.groupId && opts.populateGroup ? await UserGroups.pack(message.group || message.groupId) : undefined,
			fileId: message.fileId,
			file: message.fileId ? await DriveFiles.pack(message.fileId) : null,
			isRead: message.isRead,
			reads: message.reads,
			replyId: message.replyId,
			reply: message.reply ? await this.pack(message.reply, me, { populateRecipient: false, populateGroup: false }) : null,
			reactionCounts: message.reactionCounts || {},
			userReactions,
			isDeleted: message.isDeleted,
		};
	},
});
