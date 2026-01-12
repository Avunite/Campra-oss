import define from '../../define.js';
import { LocationTimelineService } from '@/services/location-timeline.js';
import { Notes } from '@/models/index.js';

export const meta = {
	tags: ['schools'],
	requireCredential: true,

	description: 'Get school timeline (school members only)',

	res: {
		type: 'array',
		optional: false,
		nullable: false,
		items: {
			type: 'object',
			optional: false,
			nullable: false,
			ref: 'Note',
		},
	},

	errors: {
		accessDenied: {
			message: 'Access denied: Must be a member of this school',
			code: 'ACCESS_DENIED',
			id: 'school-admin-025',
		},
		userNotFound: {
			message: 'User not found',
			code: 'USER_NOT_FOUND',
			id: 'school-admin-026',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		schoolId: { type: 'string', format: 'campra:id' },
		limit: {
			type: 'integer',
			minimum: 1,
			maximum: 100,
			default: 20,
		},
		sinceId: {
			type: 'string',
			format: 'campra:id',
		},
		untilId: {
			type: 'string',
			format: 'campra:id',
		},
		sinceDate: {
			type: 'integer',
		},
		untilDate: {
			type: 'integer',
		},
		includeNearbySchools: {
			type: 'boolean',
			default: false,
		},
		withFiles: {
			type: 'boolean',
			default: false,
		},
		radiusMiles: {
			type: 'integer',
			minimum: 1,
			maximum: 200,
			default: 50,
		},
	},
	required: ['schoolId'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Check if user belongs to this school or is a school admin for this school
	if (user.schoolId !== ps.schoolId && !(user.isSchoolAdmin && user.adminForSchoolId === ps.schoolId)) {
		throw new Error('ACCESS_DENIED');
	}

	const timelineOptions = {
		limit: ps.limit || 20,
		sinceId: ps.sinceId,
		untilId: ps.untilId,
		sinceDate: ps.sinceDate,
		untilDate: ps.untilDate,
		withFiles: ps.withFiles || false,
	};

	try {
		let timeline;

		if (ps.includeNearbySchools) {
			// Get timeline with nearby schools
			timeline = await LocationTimelineService.getSchoolTimelineWithNearby(
				ps.schoolId,
				user.id,
				timelineOptions,
				ps.radiusMiles || 50
			);
		} else {
			// Get school-only timeline
			timeline = await LocationTimelineService.getSchoolTimeline(
				ps.schoolId,
				user.id,
				timelineOptions
			);
		}

		// Pack notes for response
		return await Notes.packMany(timeline, user);
	} catch (error: any) {
		if (error.message === 'User not found') {
			throw new Error('USER_NOT_FOUND');
		}

		// Re-throw other errors
		throw error;
	}
});