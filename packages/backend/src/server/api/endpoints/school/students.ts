import define from '../../define.js';
import { Users } from '@/models/index.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['school'],
	requireCredential: true,
	description: 'Get a list of students in the school.',
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
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	if (!me.isSchoolAdmin || !me.adminForSchoolId) {
		throw new ApiError(meta.errors.permissionDenied);
	}

	const students = await Users.find({
		where: {
			schoolId: me.adminForSchoolId,
			isStaff: false,
			isAdmin: false,
			isSchoolAdmin: false,
		},
		select: ['id', 'name', 'username', 'email', 'isSuspended', 'billingExempt', 'graduationDate', 'graduationYear', 'gradeLevel', 'major', 'studentId', 'createdAt', 'avatarId'],
	});

	return students;
});
