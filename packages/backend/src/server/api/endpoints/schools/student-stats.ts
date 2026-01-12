import define from '../../define.js';
import { Users } from '@/models/index.js';
import { SchoolService } from '@/services/school-service.js';

export const meta = {
	tags: ['schools'],
	requireCredential: true,
	
	description: 'Get school student statistics (school admin only)',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			total: {
				type: 'number',
				optional: false,
				nullable: false,
			},
			recent: {
				type: 'number',
				optional: false,
				nullable: false,
			},
			active: {
				type: 'number',
				optional: false,
				nullable: false,
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Check if user is school admin
	if (!user.isSchoolAdmin || !user.adminForSchoolId) {
		throw new Error('Access denied: School admin access required');
	}

	const schoolId = user.adminForSchoolId;

	// Get total student count
	const total = await SchoolService.getStudentCount(schoolId);

	// Get recent registrations (last 30 days) using TypeORM query builder
	const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
	const recent = await Users.createQueryBuilder('user')
		.where('user.schoolId = :schoolId', { schoolId })
		.andWhere('user.createdAt > :thirtyDaysAgo', { thirtyDaysAgo })
		.getCount();

	// Get active users (logged in within last 7 days) using TypeORM query builder
	const sevenDaysAgo = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
	const active = await Users.createQueryBuilder('user')
		.where('user.schoolId = :schoolId', { schoolId })
		.andWhere('user.lastActiveDate > :sevenDaysAgo', { sevenDaysAgo })
		.getCount();

	return {
		total,
		recent,
		active,
	};
});
