import { db } from '@/db/postgre.js';
import { MessagingMessageReaction } from '@/models/entities/messaging-message-reaction.js';
import { Users, MessagingMessages } from '../index.js';
import { Packed } from '@/misc/schema.js';
import { User } from '@/models/entities/user.js';

export const MessagingMessageReactionRepository = db.getRepository(MessagingMessageReaction).extend({
	async pack(
		src: MessagingMessageReaction['id'] | MessagingMessageReaction,
		me?: { id: User['id'] } | null | undefined
	): Promise<Packed<'MessagingMessageReaction'>> {
		const reaction = typeof src === 'object' ? src : await this.findOneByOrFail({ id: src });

		return {
			id: reaction.id,
			createdAt: reaction.createdAt.toISOString(),
			userId: reaction.userId,
			user: await Users.pack(reaction.user || reaction.userId, me),
			messageId: reaction.messageId,
			reaction: reaction.reaction,
		};
	},
});
