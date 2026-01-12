import define from '../../define.js';
import { EmailVerificationService } from '@/services/email-verification.js';
import { Schools } from '@/models/index.js';

export const meta = {
	tags: ['schools'],
	requireCredential: true,
	
	description: 'Invite new school admin (school admin only)',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			success: {
				type: 'boolean',
				optional: false,
				nullable: false,
			},
			message: {
				type: 'string',
				optional: false,
				nullable: false,
			},
		},
	},

	errors: {
		accessDenied: {
			message: 'Access denied: School admin access required',
			code: 'ACCESS_DENIED',
			id: 'school-admin-025',
		},
		invalidEmail: {
			message: 'Invalid email format',
			code: 'INVALID_EMAIL',
			id: 'school-admin-026',
		},
		schoolNotFound: {
			message: 'School not found',
			code: 'SCHOOL_NOT_FOUND',
			id: 'school-admin-027',
		},
		emailFailed: {
			message: 'Failed to send invitation email',
			code: 'EMAIL_FAILED',
			id: 'school-admin-028',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		email: { 
			type: 'string', 
			maxLength: 256,
		},
	},
	required: ['email'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Check if user is school admin
	if (!user.isSchoolAdmin || !user.adminForSchoolId) {
		throw new Error('ACCESS_DENIED');
	}

	const schoolId = user.adminForSchoolId;

	// Validate email format
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(ps.email)) {
		throw new Error('INVALID_EMAIL');
	}

	// Get school information
	const school = await Schools.findOneBy({ id: schoolId });
	if (!school) {
		throw new Error('SCHOOL_NOT_FOUND');
	}

	try {
		// Send school admin verification email
		await EmailVerificationService.sendSchoolAdminVerification(
			ps.email.toLowerCase(),
			schoolId,
			school.name
		);

		return {
			success: true,
			message: `Invitation sent to ${ps.email}`,
		};
	} catch (error: any) {
		console.error('Failed to send admin invitation:', error);
		throw new Error('EMAIL_FAILED');
	}
});