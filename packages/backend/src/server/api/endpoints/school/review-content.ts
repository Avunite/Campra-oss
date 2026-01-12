import define from '../../define.js';
import { ApiError } from '../../error.js';
import { ProfileContentModerator } from '@/services/profile-content-moderator.js';
import { ChannelContentModerator } from '@/services/channel-content-moderator.js';
import Logger from '@/services/logger.js';

const logger = new Logger('school-moderation-review');

export const meta = {
	tags: ['school', 'moderation'],
	requireCredential: true,
	requireSchoolAdmin: true,
	description: 'Review and take action on flagged content.',
	errors: {
		permissionDenied: {
			message: 'Permission denied.',
			code: 'PERMISSION_DENIED',
			id: 'b9737a88-b703-4425-9365-3848b89e324d',
		},
		invalidAction: {
			message: 'Invalid action.',
			code: 'INVALID_ACTION',
			id: 'f1e2d3c4-b5a6-9780-1234-567890abcdef',
		},
		contentNotFound: {
			message: 'Content not found.',
			code: 'CONTENT_NOT_FOUND',
			id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		contentType: {
			type: 'string',
			enum: ['profile', 'channel'],
		},
		contentId: {
			type: 'string',
			format: 'campra:id',
		},
		action: {
			type: 'string',
			enum: ['approve', 'reject', 'suspend'],
		},
		reason: {
			type: 'string',
			maxLength: 500,
		},
	},
	required: ['contentType', 'contentId', 'action'],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	if (!me.isSchoolAdmin || !me.adminForSchoolId) {
		throw new ApiError(meta.errors.permissionDenied);
	}

	let result;

	try {
		if (ps.contentType === 'profile') {
			// Review profile content (user ID is the content ID)
			result = await ProfileContentModerator.reviewProfileContent(
				me.id,
				ps.contentId,
				ps.action,
				ps.reason
			);
		} else if (ps.contentType === 'channel') {
			// Review channel content
			result = await ChannelContentModerator.reviewChannelContent(
				me.id,
				ps.contentId,
				ps.action,
				ps.reason
			);
		} else {
			throw new ApiError(meta.errors.invalidAction);
		}

		if (!result.success) {
			if (result.message === 'User not found' || result.message === 'User or channel not found') {
				throw new ApiError(meta.errors.contentNotFound);
			} else if (result.message === 'Permission denied') {
				throw new ApiError(meta.errors.permissionDenied);
			} else {
				throw new ApiError(meta.errors.invalidAction);
			}
		}

		logger.info(`School admin ${me.username} reviewed ${ps.contentType} content:`, {
			adminId: me.id,
			contentType: ps.contentType,
			contentId: ps.contentId,
			action: ps.action,
			reason: ps.reason || 'No reason provided',
			schoolId: me.adminForSchoolId,
		});

		return {
			success: true,
			action: ps.action,
			contentType: ps.contentType,
			contentId: ps.contentId,
		};

	} catch (error) {
		if (error instanceof ApiError) {
			throw error;
		}
		
		logger.error(`Failed to review ${ps.contentType} content:`, {
			error: error instanceof Error ? error.message : String(error),
			adminId: me.id,
			contentType: ps.contentType,
			contentId: ps.contentId,
			action: ps.action,
		});

		throw new ApiError(meta.errors.invalidAction);
	}
});
