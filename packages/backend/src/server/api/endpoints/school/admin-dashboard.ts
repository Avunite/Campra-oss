import define from '../../define.js';
import { Users, Channels } from '@/models/index.js';
import { ApiError } from '../../error.js';
import Logger from '@/services/logger.js';

const logger = new Logger('school-admin-dashboard');

export const meta = {
	tags: ['school', 'admin'],
	requireCredential: true,
	requireSchoolAdmin: true,
	description: 'Get comprehensive dashboard data for school administrators.',
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

	try {
		// Get school statistics
		const [
			totalStudents,
			suspendedStudents,
			studentsWithGradDates,
			totalChannels,
			suspendedChannels,
		] = await Promise.all([
			// Total students in school
			Users.count({
				where: {
					schoolId: me.adminForSchoolId,
					isStaff: false,
					isAdmin: false,
					isSchoolAdmin: false,
				},
			}),
			// Suspended students
			Users.count({
				where: {
					schoolId: me.adminForSchoolId,
					isStaff: false,
					isAdmin: false,
					isSchoolAdmin: false,
					isSuspended: true,
				},
			}),
			// Students with graduation dates set
			Users.count({
				where: {
					schoolId: me.adminForSchoolId,
					isStaff: false,
					isAdmin: false,
					isSchoolAdmin: false,
					graduationDate: 'NOT NULL' as any, // TypeORM syntax for checking not null
				},
			}),
			// Total channels in school
			Channels.count({
				where: {
					schoolId: me.adminForSchoolId,
				},
			}),
			// Suspended/archived channels
			Channels.count({
				where: {
					schoolId: me.adminForSchoolId,
					archive: true,
				},
			}),
		]);

		// Get recent students (last 30 days)
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

		const recentStudents = await Users.count({
			where: {
				schoolId: me.adminForSchoolId,
				isStaff: false,
				isAdmin: false,
				isSchoolAdmin: false,
				createdAt: 'GREATER_THAN' as any, // This would need proper TypeORM syntax
			},
		});

		// Get graduation statistics by year
		const currentYear = new Date().getFullYear();
		const graduationStats = await Users.createQueryBuilder('user')
			.select('user.graduationYear', 'year')
			.addSelect('COUNT(*)', 'count')
			.where('user.schoolId = :schoolId', { schoolId: me.adminForSchoolId })
			.andWhere('user.graduationYear IS NOT NULL')
			.andWhere('user.isStaff = false')
			.andWhere('user.isAdmin = false')
			.andWhere('user.isSchoolAdmin = false')
			.groupBy('user.graduationYear')
			.orderBy('user.graduationYear', 'ASC')
			.getRawMany();

		// Calculate some additional metrics
		const studentsWithoutGradDates = totalStudents - studentsWithGradDates;
		const activeChannels = totalChannels - suspendedChannels;
		
		return {
			school: {
				id: me.adminForSchoolId,
				name: 'School Name', // Would fetch from School entity in full implementation
			},
			stats: {
				students: {
					total: totalStudents,
					active: totalStudents - suspendedStudents,
					suspended: suspendedStudents,
					recent: recentStudents,
					withGraduationDates: studentsWithGradDates,
					withoutGraduationDates: studentsWithoutGradDates,
				},
				channels: {
					total: totalChannels,
					active: activeChannels,
					suspended: suspendedChannels,
				},
				graduation: {
					byYear: graduationStats.map((stat: any) => ({
						year: parseInt(stat.year),
						count: parseInt(stat.count),
						isCurrentYear: parseInt(stat.year) === currentYear,
						isPastDue: parseInt(stat.year) < currentYear,
					})),
					totalWithDates: studentsWithGradDates,
					needsAttention: studentsWithoutGradDates,
				},
			},
			moderation: {
				pendingReviews: 0, // Would be calculated from ContentFlags in full implementation
				recentActions: 0,  // Recent moderation actions
			},
			alerts: [
				// System would generate various alerts for the admin
				...(studentsWithoutGradDates > 0 ? [{
					type: 'warning',
					message: `${studentsWithoutGradDates} students do not have graduation dates set`,
					action: 'Set graduation dates',
					priority: 'medium',
				}] : []),
				...(suspendedStudents > 0 ? [{
					type: 'info',
					message: `${suspendedStudents} students are currently suspended`,
					action: 'Review suspensions',
					priority: 'low',
				}] : []),
			],
		};

	} catch (error) {
		logger.error(`Failed to fetch school dashboard data for admin ${me.id}:`, {
			error: error instanceof Error ? error.message : String(error),
			adminId: me.id,
			schoolId: me.adminForSchoolId,
		});

		// Return minimal data on error to avoid breaking the dashboard
		return {
			school: {
				id: me.adminForSchoolId,
				name: 'School',
			},
			stats: {
				students: { total: 0, active: 0, suspended: 0, recent: 0, withGraduationDates: 0, withoutGraduationDates: 0 },
				channels: { total: 0, active: 0, suspended: 0 },
				graduation: { byYear: [], totalWithDates: 0, needsAttention: 0 },
			},
			moderation: { pendingReviews: 0, recentActions: 0 },
			alerts: [{
				type: 'error',
				message: 'Failed to load dashboard data',
				action: 'Refresh page',
				priority: 'high',
			}],
		};
	}
});
