import define from '../../define.js';
import { ApiError } from '../../error.js';
import { Channels, DriveFiles } from '@/models/index.js';
import { ChannelContentModerator } from '@/services/channel-content-moderator.js';
import Logger from '@/services/logger.js';

const logger = new Logger('channel-update');

export const meta = {
	tags: ['channels'],

	requireCredential: true,

	kind: 'write:channels',

	res: {
		type: 'object',
		optional: false, nullable: false,
		ref: 'Channel',
	},

	errors: {
		noSuchChannel: {
			message: 'No such channel.',
			code: 'NO_SUCH_CHANNEL',
			id: 'f9c5467f-d492-4c3c-9a8d-a70dacc86512',
		},

		accessDenied: {
			message: 'You do not have edit privilege of the channel.',
			code: 'ACCESS_DENIED',
			id: '1fb7cb09-d46a-4fdf-b8df-057788cce513',
		},

		noSuchFile: {
			message: 'No such file.',
			code: 'NO_SUCH_FILE',
			id: 'e86c14a4-0da2-4032-8df3-e737a04c7f3b',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		channelId: { type: 'string', format: 'campra:id' },
		name: { type: 'string', minLength: 1, maxLength: 128 },
		description: { type: 'string', nullable: true, minLength: 1, maxLength: 2048 },
		bannerId: { type: 'string', format: 'campra:id', nullable: true },
	},
	required: ['channelId'],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps, me) => {
	const channel = await Channels.findOneBy({
		id: ps.channelId,
	});

	if (channel == null) {
		throw new ApiError(meta.errors.noSuchChannel);
	}

	if (channel.userId !== me.id) {
		throw new ApiError(meta.errors.accessDenied);
	}

	// eslint:disable-next-line:no-unnecessary-initializer
	let banner = undefined;
	if (ps.bannerId != null) {
		banner = await DriveFiles.findOneBy({
			id: ps.bannerId,
			userId: me.id,
		});

		if (banner == null) {
			throw new ApiError(meta.errors.noSuchFile);
		}
	} else if (ps.bannerId === null) {
		banner = null;
	}

	// Moderate channel content before update
	if (ps.name !== undefined || ps.description !== undefined) {
		try {
			const moderationResult = await ChannelContentModerator.moderateChannelContent(me.id, {
				name: ps.name || channel.name,
				description: ps.description !== undefined ? ps.description : channel.description,
				schoolId: channel.schoolId,
			});

			if (moderationResult.needsReview) {
				logger.info(`Channel update flagged for moderation for user ${me.id}:`, {
					userId: me.id,
					username: me.username,
					channelId: channel.id,
					channelName: channel.name,
					schoolId: channel.schoolId,
					details: moderationResult.details,
				});

				// Note: We still allow the update to proceed but it's flagged for review
				// This ensures the user experience isn't broken while still enabling moderation
			}
		} catch (error) {
			logger.warn(`Channel moderation failed for user ${me.id}, proceeding with update:`, { error: error instanceof Error ? error.message : String(error) });
		}
	}

	await Channels.update(channel.id, {
		...(ps.name !== undefined ? { name: ps.name } : {}),
		...(ps.description !== undefined ? { description: ps.description } : {}),
		...(banner ? { bannerId: banner.id } : {}),
	});

	return await Channels.pack(channel.id, me);
});
