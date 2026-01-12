import define from '../../define.js';
import { Users } from '@/models/index.js';
import { ApiError } from '../../error.js';
import { UsernameValidator } from '@/services/username-validator.js';
import Logger from '@/services/logger.js';

const logger = new Logger('school-username-override');

export const meta = {
	tags: ['school'],
	requireCredential: true,
	requireSchoolAdmin: true,
	description: 'Allow or override username for a student in the school.',
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
		invalidUsername: {
			message: 'Invalid username format.',
			code: 'INVALID_USERNAME',
			id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
		},
		usernameTaken: {
			message: 'Username is already taken.',
			code: 'USERNAME_TAKEN',
			id: 'b2c3d4e5-f6g7-h8i9-j0k1-l2m3n4o5p6q7',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { 
			type: 'string', 
			format: 'campra:id',
			description: 'ID of the student to update username for'
		},
		username: { 
			type: 'string',
			minLength: 1,
			maxLength: 32,
			description: 'New username for the student'
		},
		bypassValidation: {
			type: 'boolean',
			default: false,
			description: 'Whether to bypass name validation (admin override)'
		},
		reason: {
			type: 'string',
			maxLength: 500,
			description: 'Reason for the override (required if bypassValidation is true)'
		},
	},
	required: ['userId', 'username'],
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

	// Basic format validation
	const formatValidation = UsernameValidator.validateUsernameFormat(ps.username);
	if (!formatValidation.isValid) {
		throw new ApiError(meta.errors.invalidUsername);
	}

	// Check if username is already taken
	const existingUser = await Users.findOne({
		where: {
			usernameLower: ps.username.toLowerCase(),
			host: null,
		},
		select: ['id'],
	});

	if (existingUser && existingUser.id !== ps.userId) {
		throw new ApiError(meta.errors.usernameTaken);
	}

	let validationResult = { isValid: true };

	// If not bypassing validation, check against real name
	if (!ps.bypassValidation && targetUser.name) {
		validationResult = await UsernameValidator.validateUsernameAgainstName(
			ps.username,
			targetUser.name,
			ps.userId
		);

		if (!validationResult.isValid) {
			return {
				success: false,
				validation: validationResult,
				message: 'Username validation failed. Set bypassValidation=true to override.',
			};
		}
	}

	// Update the username
	await Users.update(ps.userId, {
		username: ps.username,
		usernameLower: ps.username.toLowerCase(),
		updatedAt: new Date(),
	});

	// Log the change
	const logData = {
		adminId: me.id,
		adminUsername: me.username,
		targetUserId: ps.userId,
		targetUsername: targetUser.username,
		newUsername: ps.username,
		bypassedValidation: ps.bypassValidation,
		reason: ps.reason || null,
		schoolId: me.adminForSchoolId,
	};

	if (ps.bypassValidation) {
		logger.warn('School admin bypassed username validation:', logData);
	} else {
		logger.info('School admin updated username:', logData);
	}

	return {
		success: true,
		username: ps.username,
		bypassedValidation: ps.bypassValidation || false,
		validation: validationResult,
	};
});
