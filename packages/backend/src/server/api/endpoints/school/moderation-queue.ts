import define from '../../define.js';
import { ApiError } from '../../error.js';
import { ProfileContentModerator } from '@/services/profile-content-moderator.js';
import { ChannelContentModerator } from '@/services/channel-content-moderator.js';
import Logger from '@/services/logger.js';

const logger = new Logger('school-moderation-queue');

export const meta = {
	tags: ['school', 'moderation'],
	requireCredential: true,
	requireSchoolAdmin: true,
	description: 'Get pending content moderation items for the school.',
	errors: {
		permissionDenied: {
			message: 'Permission denied.',
			code: 'PERMISSION_DENIED',
			id: 'b9737a88-b703-4425-9365-3848b89e324d',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		type: {
			type: 'string',
			enum: ['all', 'profiles', 'channels'],
			default: 'all',
		},
		limit: {
			type: 'integer',
			minimum: 1,
			maximum: 100,
			default: 50,
		},
		offset: {
			type: 'integer',
			minimum: 0,
			default: 0,
		},
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	if (!me.isSchoolAdmin || !me.adminForSchoolId) {
		throw new ApiError(meta.errors.permissionDenied);
	}

	const results = {
		profiles: [] as any[],
		channels: [] as any[],
		summary: {
			totalProfiles: 0,
			totalChannels: 0,
			totalPending: 0,
		},
	};

	try {
		// Get pending profile moderation items
		if (ps.type === 'all' || ps.type === 'profiles') {
			const profileItems = await ProfileContentModerator.getPendingModerationForSchool(me.adminForSchoolId);
			results.profiles = profileItems.slice(ps.offset, ps.offset + ps.limit);
			results.summary.totalProfiles = profileItems.length;
		}

		// Get pending channel moderation items
		if (ps.type === 'all' || ps.type === 'channels') {
			const channelItems = await ChannelContentModerator.getPendingChannelModerationForSchool(me.adminForSchoolId);
			results.channels = channelItems.slice(ps.offset, ps.offset + ps.limit);
			results.summary.totalChannels = channelItems.length;
		}

		results.summary.totalPending = results.summary.totalProfiles + results.summary.totalChannels;

	} catch (error) {
		// Return empty results on error to avoid breaking the admin interface
		logger.error('Failed to fetch pending moderation items:', { error: error instanceof Error ? error.message : String(error) });
	}

	return results;
});
