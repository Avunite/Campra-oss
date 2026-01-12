import define from '../../define.js';
import { Users } from '@/models/index.js';
import { ApiError } from '../../error.js';
import { SchoolService } from '@/services/school-service.js';

export const meta = {
	tags: ['school'],
	requireCredential: true,
	description: 'Unsuspend a student as a school admin.',
	errors: {
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
		},
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
		userId: { type: 'string', format: 'campra:id' },
	},
	required: ['userId'],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	if (!me.isSchoolAdmin || !me.adminForSchoolId) {
		throw new ApiError(meta.errors.permissionDenied);
	}

	const student = await Users.findOneBy({ id: ps.userId });

	if (!student) {
		throw new ApiError(meta.errors.noSuchUser);
	}

	if (student.schoolId !== me.adminForSchoolId) {
		throw new ApiError(meta.errors.permissionDenied);
	}

	await Users.update(student.id, { isSuspended: false, billingExempt: false });

	await SchoolService.updateStudentCountAndBilling(me.adminForSchoolId);

	return {};
});
