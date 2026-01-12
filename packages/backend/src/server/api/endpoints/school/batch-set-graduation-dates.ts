import define from '../../define.js';
import { Users } from '@/models/index.js';
import { ApiError } from '../../error.js';
import Logger from '@/services/logger.js';

const logger = new Logger('school-graduation');

export const meta = {
	tags: ['school'],
	requireCredential: true,
	requireSchoolAdmin: true,
	description: 'Set graduation dates for multiple students in the school.',
	errors: {
		permissionDenied: {
			message: 'Permission denied.',
			code: 'PERMISSION_DENIED',
			id: 'b9737a88-b703-4425-9365-3848b89e324d',
		},
		invalidData: {
			message: 'Invalid batch data.',
			code: 'INVALID_DATA',
			id: 'f1e2d3c4-b5a6-9780-1234-567890abcdef',
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
					graduationDate: { 
						...Users.graduationDateSchema,
						nullable: true,
					},
				},
				required: ['userId'],
			},
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
					error: 'User not in your school',
				});
				continue;
			}

			// Validate graduation date if provided
			let graduationDate: Date | null = null;
			if (student.graduationDate) {
				graduationDate = new Date(student.graduationDate);
				if (isNaN(graduationDate.getTime())) {
					errors.push({
						userId: student.userId,
						error: 'Invalid graduation date',
					});
					continue;
				}
			}

			// Update the user's graduation date
			await Users.update(student.userId, {
				graduationDate: graduationDate,
				updatedAt: new Date(),
			});

			results.push({
				userId: student.userId,
				graduationDate: graduationDate?.toISOString().split('T')[0] || null,
				success: true,
			});

		} catch (error) {
			logger.error(`Failed to update graduation date for user ${student.userId}:`, { error: error instanceof Error ? error.message : String(error) });
			errors.push({
				userId: student.userId,
				error: 'Failed to update',
			});
		}
	}

	return {
		updated: results,
		errors: errors,
		summary: {
			total: ps.students.length,
			updated: results.length,
			failed: errors.length,
		},
	};
});
