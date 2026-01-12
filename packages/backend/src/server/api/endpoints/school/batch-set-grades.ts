import define from '../../define.js';
import { Users } from '@/models/index.js';
import { ApiError } from '../../error.js';
import Logger from '@/services/logger.js';

const logger = new Logger('school-bulk-grades');

export const meta = {
	tags: ['school'],
	requireCredential: true,
	requireSchoolAdmin: true,
	description: 'Set grade levels for multiple students in the school.',
	errors: {
		permissionDenied: {
			message: 'Permission denied.',
			code: 'PERMISSION_DENIED',
			id: 'b9737a88-b703-4425-9365-3848b89e324e',
		},
		invalidData: {
			message: 'Invalid batch data.',
			code: 'INVALID_DATA',
			id: 'f1e2d3c4-b5a6-9780-1234-567890abcde0',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		students: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					userId: {
						type: 'string',
						format: 'campra:id',
					},
					gradeLevel: {
						type: 'string',
						maxLength: 32,
						nullable: true,
					},
				},
				required: ['userId'],
			},
			minItems: 1,
			maxItems: 100, // Limit batch size
		},
	},
	required: ['students'],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	if (!me.isSchoolAdmin || !me.adminForSchoolId) {
		throw new ApiError(meta.errors.permissionDenied);
	}

	const results = [];
	const errors = [];

	for (const student of ps.students) {
		try {
			// Find the target user
			const targetUser = await Users.findOneBy({ id: student.userId });
			if (!targetUser) {
				errors.push({
					userId: student.userId,
					error: 'User not found',
				});
				continue;
			}

			// Verify the user is in the admin's school
			if (targetUser.schoolId !== me.adminForSchoolId) {
				errors.push({
					userId: student.userId,
					error: 'User is not in your school',
				});
				continue;
			}

			// Update the grade level
			await Users.update(student.userId, {
				gradeLevel: student.gradeLevel || null,
				updatedAt: new Date(),
			});

			results.push({
				userId: student.userId,
				success: true,
				gradeLevel: student.gradeLevel || null,
			});

			logger.info(`School admin ${me.id} updated grade level for user ${student.userId} to ${student.gradeLevel || 'null'}`);
		} catch (error: any) {
			logger.error(`Failed to update grade for user ${student.userId}:`, error);
			errors.push({
				userId: student.userId,
				error: error.message || 'Unknown error',
			});
		}
	}

	return {
		success: errors.length === 0,
		updated: results.length,
		results,
		errors,
	};
});
