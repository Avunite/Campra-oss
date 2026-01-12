import define from '../../define.js';
import { Users } from '@/models/index.js';
import { ApiError } from '../../error.js';
import Logger from '@/services/logger.js';

const logger = new Logger('school-graduation');

export const meta = {
	tags: ['school'],
	requireCredential: true,
	requireSchoolAdmin: true,
	description: 'Set graduation date for a student in the school.',
	errors: {
		permissionDenied: {
			message: 'Permission denied.',
			code: 'PERMISSION_DENIED',
			id: 'b9737a88-b703-4425-9365-3848b89e324d',
		},
		userNotFound: {
			message: 'User not found.',
			code: 'USER_NOT_FOUND',
			id: '4362f8dc-731f-4ad8-a694-be2a88922a24',
		},
		notInSchool: {
			message: 'User is not in your school.',
			code: 'NOT_IN_SCHOOL',
			id: 'f8c8b8d4-7e5f-4a3c-b2d1-9e8f7a6b5c4d',
		},
		invalidDate: {
			message: 'Invalid graduation date.',
			code: 'INVALID_DATE',
			id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { 
			type: 'string', 
			format: 'campra:id',
			description: 'ID of the student to set graduation date for'
		},
		graduationDate: { 
			...Users.graduationDateSchema,
			nullable: true,
			description: 'Graduation date in YYYY-MM-DD format, or null to clear'
		},
	},
	required: ['userId'],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	if (!me.isSchoolAdmin || !me.adminForSchoolId) {
		throw new ApiError(meta.errors.permissionDenied);
	}

	// Find the target user
	const targetUser = await Users.findOneBy({ id: ps.userId });
	if (!targetUser) {
		throw new ApiError(meta.errors.userNotFound);
	}

	// Verify the user is in the admin's school
	if (targetUser.schoolId !== me.adminForSchoolId) {
		throw new ApiError(meta.errors.notInSchool);
	}

	// Validate graduation date if provided
	let graduationDate: Date | null = null;
	if (ps.graduationDate) {
		graduationDate = new Date(ps.graduationDate);
		if (isNaN(graduationDate.getTime())) {
			throw new ApiError(meta.errors.invalidDate);
		}
		
		// Check if date is in the future (optional validation)
		const now = new Date();
		if (graduationDate < now) {
			// Allow past dates for record-keeping but log a warning
			logger.warn(`Setting graduation date in the past for user ${ps.userId}: ${ps.graduationDate}`);
		}
	}

	// Update the user's graduation date
	await Users.update(ps.userId, {
		graduationDate: graduationDate,
		updatedAt: new Date(),
	});

	return {
		success: true,
		graduationDate: graduationDate?.toISOString().split('T')[0] || null,
	};
});
