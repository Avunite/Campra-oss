import define from '../../define.js';
import { Schools, Users, Notes } from '@/models/index.js';

export const meta = {
	tags: ['schools'],
	requireCredential: true,
	
	description: 'Get school analytics and usage statistics',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			activeUsers: {
				type: 'integer',
				description: 'Number of users active in the last 7 days',
			},
			postsThisWeek: {
				type: 'integer',
				description: 'Number of posts created in the last 7 days',
			},
			engagementRate: {
				type: 'string',
				description: 'Engagement rate percentage',
			},
			totalUsers: {
				type: 'integer',
				description: 'Total number of users from this school',
			},
			newUsersThisWeek: {
				type: 'integer',
				description: 'New user registrations in the last 7 days',
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

	// Get school information
	const school = await Schools.findOneBy({ id: schoolId });
	if (!school) {
		throw new Error('School not found');
	}

	const oneWeekAgo = new Date();
	oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

	// Get total users from this school
	const totalUsers = await Users.count({
		where: {
			schoolId: schoolId,
			isAlumni: false,
		},
	});

	// Get active users (users who have been active in the last 7 days) 
	// Using a raw query to avoid TypeORM import issues
	const activeUsers = await Users.createQueryBuilder('user')
		.where('user.schoolId = :schoolId', { schoolId })
		.andWhere('user.isAlumni = false')
		.andWhere('user.lastActiveDate > :oneWeekAgo', { oneWeekAgo })
		.getCount();

	// Get new users this week
	const newUsersThisWeek = await Users.createQueryBuilder('user')
		.where('user.schoolId = :schoolId', { schoolId })
		.andWhere('user.isAlumni = false')
		.andWhere('user.createdAt > :oneWeekAgo', { oneWeekAgo })
		.getCount();

	// Get posts this week from school users
	const schoolUsers = await Users.find({
		where: { schoolId: schoolId, isAlumni: false },
		select: ['id'],
	});

	const schoolUserIds = schoolUsers.map((u: any) => u.id);

	let postsThisWeek = 0;
	if (schoolUserIds.length > 0) {
		postsThisWeek = await Notes.createQueryBuilder('note')
			.where('note.userId IN (:...userIds)', { userIds: schoolUserIds })
			.andWhere('note.createdAt > :oneWeekAgo', { oneWeekAgo })
			.getCount();
	}

	// Calculate engagement rate (active users / total users * 100)
	const engagementRate = totalUsers > 0 
		? `${Math.round((activeUsers / totalUsers) * 100)}%`
		: '0%';

	return {
		activeUsers,
		postsThisWeek,
		engagementRate,
		totalUsers,
		newUsersThisWeek,
	};
});
