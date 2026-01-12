import define from '../../../../define.js';
import { ApiError } from '../../../../error.js';
import { getUser } from '../../../../common/getters.js';
import { MessagingMessages, MessagingMessageReactions, UserGroupJoinings } from '@/models/index.js';
import { MessagingMessageReaction } from '@/models/entities/messaging-message-reaction.js';
import { genId } from '@/misc/gen-id.js';
import { publishMessagingStream, publishGroupMessagingStream } from '@/services/stream.js';

export const meta = {
	tags: ['messaging'],

	requireCredential: true,

	kind: 'write:messaging',

	errors: {
		noSuchMessage: {
			message: 'No such message.',
			code: 'NO_SUCH_MESSAGE',
			id: '54b5b326-7925-42cf-8019-130fda8b56af',
		},

		youAreNotRecipient: {
			message: 'You are not a recipient of this message.',
			code: 'YOU_ARE_NOT_RECIPIENT',
			id: '2ce9b3f9-fd08-4a15-8289-da5b5b82e4cb',
		},

		alreadyReacted: {
			message: 'You are already reacting to that message.',
			code: 'ALREADY_REACTED',
			id: 'b5b6b029-cd14-4d24-ba71-1c94cc2c5d55',
		},
	},

	res: {
		type: 'object',
		optional: false, nullable: false,
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		messageId: { type: 'string', format: 'campra:id' },
		reaction: { type: 'string' },
	},
	required: ['messageId', 'reaction'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Get the message
	const message = await MessagingMessages.findOne({
		where: {
			id: ps.messageId,
			isDeleted: false,
		},
		relations: {
			user: true,
			recipient: true,
			group: true,
		},
	});

	if (message == null) {
		throw new ApiError(meta.errors.noSuchMessage);
	}

	// Check if user is part of this conversation
	let isRecipient = false;
	if (message.recipientId === user.id || message.userId === user.id) {
		isRecipient = true;
	} else if (message.groupId) {
		// Check if user is in the group
		const joining = await UserGroupJoinings.findOne({
			where: {
				userId: user.id,
				userGroupId: message.groupId,
			},
		});
		isRecipient = !!joining;
	}

	if (!isRecipient) {
		throw new ApiError(meta.errors.youAreNotRecipient);
	}

	// Check if already reacted
	const existing = await MessagingMessageReactions.findOne({
		where: {
			messageId: ps.messageId,
			userId: user.id,
			reaction: ps.reaction,
		},
	});

	if (existing) {
		throw new ApiError(meta.errors.alreadyReacted);
	}

	// Create reaction
	const reaction = await MessagingMessageReactions.insert({
		id: genId(),
		createdAt: new Date(),
		messageId: ps.messageId,
		userId: user.id,
		reaction: ps.reaction,
	} as MessagingMessageReaction);

	// Update reaction counts
	const currentCounts = message.reactionCounts || {};
	currentCounts[ps.reaction] = (currentCounts[ps.reaction] || 0) + 1;

	await MessagingMessages.update(ps.messageId, {
		reactionCounts: currentCounts,
	});

	// Publish to streams
	const recipientId = message.recipientId === user.id ? message.userId : message.recipientId;
	if (recipientId) {
		publishMessagingStream(recipientId, user.id, 'reaction', {
			messageId: ps.messageId,
			reaction: ps.reaction,
			userId: user.id,
			reactionCounts: currentCounts,
		});
	}

	if (message.groupId) {
		// Publish to all group members
		const joinings = await UserGroupJoinings.find({
			where: { userGroupId: message.groupId },
		});

		publishGroupMessagingStream(message.groupId, 'reaction', {
			messageId: ps.messageId,
			reaction: ps.reaction,
			userId: user.id,
			reactionCounts: currentCounts,
		});
	}

	return {};
});
