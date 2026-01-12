import define from '../../define.js';
import { Users, UserProfiles } from '@/models/index.js';

export const meta = {
	tags: ['schools'],
	requireCredential: true,
	
	description: 'List teachers for school (school admin only)',

	res: {
		type: 'array',
		optional: false,
		nullable: false,
		items: {
			type: 'object',
			properties: {
				id: {
					type: 'string',
					optional: false,
					nullable: false,
					format: 'campra:id',
				},
				username: {
					type: 'string',
					optional: false,
					nullable: false,
				},
				name: {
					type: 'string',
					optional: false,
					nullable: false,
				},
				email: {
					type: 'string',
					optional: false,
					nullable: false,
				},
				isSchoolAdmin: {
					type: 'boolean',
					optional: false,
					nullable: false,
				},
				isTeacher: {
					type: 'boolean',
					optional: false,
					nullable: false,
				},
				enrollmentStatus: {
					type: 'string',
					optional: false,
					nullable: false,
				},
				createdAt: {
					type: 'string',
					optional: false,
					nullable: false,
					format: 'date-time',
				},
				lastActiveAt: {
					type: 'string',
					optional: true,
					nullable: true,
					format: 'date-time',
				},
				emailVerified: {
					type: 'boolean',
					optional: false,
					nullable: false,
				},
				isSuspended: {
					type: 'boolean',
					optional: false,
					nullable: false,
				},
			},
		},
	},

	errors: {
		accessDenied: {
			message: 'Access denied: School admin access required',
			code: 'ACCESS_DENIED',
			id: 'school-admin-024',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { 
			type: 'integer', 
			minimum: 1, 
			maximum: 100, 
			default: 20,
		},
		offset: { 
			type: 'integer', 
			minimum: 0, 
			default: 0,
		},
		search: { 
			type: 'string', 
			maxLength: 100,
		},
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Check if user is school admin
	if (!user.isSchoolAdmin || !user.adminForSchoolId) {
		throw new Error('Access denied: School admin access required');
	}

	const schoolId = user.adminForSchoolId;

	// Query for teachers using query builder for more control
	let query = Users.createQueryBuilder('user')
		.where('user.schoolId = :schoolId', { schoolId })
		.andWhere('(user.isTeacher = true OR user.isSchoolAdmin = true)')
		.orderBy('user.createdAt', 'DESC')
		.take(ps.limit || 20)
		.skip(ps.offset || 0)
		.select([
			'user.id',
			'user.username',
			'user.name',
			'user.isSchoolAdmin',
			'user.isTeacher',
			'user.enrollmentStatus',
			'user.isSuspended',
			'user.createdAt',
			'user.lastActiveDate',
		]);

	// Add search filter if provided
	if (ps.search) {
		const searchTerm = `%${ps.search.toLowerCase()}%`;
		query = query.andWhere('LOWER(user.name) LIKE :searchTerm', { searchTerm });
	}

	// Execute query
	const teachers = await query.getMany();

	// Get user profiles for emails and verification status
	const userIds = teachers.map((teacher: any) => teacher.id);
	let userProfiles: any[] = [];
	
	// Only query if we have userIds to avoid empty IN clause SQL error
	if (userIds.length > 0) {
		userProfiles = await UserProfiles.createQueryBuilder('profile')
			.select(['profile.userId', 'profile.email', 'profile.emailVerified'])
			.where('profile.userId IN (:...userIds)', { userIds })
			.getMany();
	}

	// Create a map for quick lookup
	const profileMap = new Map<string, { email: string | null; emailVerified: boolean }>();
	userProfiles.forEach((profile: any) => {
		profileMap.set(profile.userId, {
			email: profile.email,
			emailVerified: profile.emailVerified || false,
		});
	});

	return teachers.map((teacher: any) => {
		const profile = profileMap.get(teacher.id) || { email: null, emailVerified: false };
		
		return {
			id: teacher.id,
			username: teacher.username,
			name: teacher.name,
			email: profile.email,
			isSchoolAdmin: teacher.isSchoolAdmin,
			isTeacher: teacher.isTeacher,
			enrollmentStatus: teacher.enrollmentStatus,
			emailVerified: profile.emailVerified,
			isSuspended: teacher.isSuspended || false,
			createdAt: teacher.createdAt.toISOString(),
			lastActiveAt: teacher.lastActiveDate?.toISOString() || null,
		};
	});
});