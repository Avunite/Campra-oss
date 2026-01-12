import define from '../../define.js';
import { Schools, Users, UserProfiles } from '@/models/index.js';
import Logger from '@/services/logger.js';

const logger = new Logger('list-school-admins');

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
	
	description: 'List all administrators for a specific school',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			admins: {
				type: 'array',
				optional: false,
				nullable: false,
				items: {
					type: 'object',
					optional: false,
					nullable: false,
					properties: {
						id: { type: 'string', format: 'campra:id' },
						username: { type: 'string' },
						name: { type: 'string' },
						email: { type: 'string' },
						createdAt: { type: 'string', format: 'date-time' },
						lastActiveDate: { type: 'string', format: 'date-time', nullable: true },
						isActive: { type: 'boolean' },
					},
				},
			},
			school: {
				type: 'object',
				optional: false,
				nullable: false,
				properties: {
					id: { type: 'string' },
					name: { type: 'string' },
					domain: { type: 'string' },
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		schoolId: { type: 'string', format: 'campra:id' },
	},
	required: ['schoolId'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	logger.info('list-school-admins called with:', ps);
	
	// Verify the school exists
	const school = await Schools.findOneBy({ id: ps.schoolId });
	if (!school) {
		logger.warn('School not found:', ps.schoolId);
		throw new Error('School not found');
	}
	
	logger.info('Found school:', school.name);

	// Get all school admins for this school
	const admins = await Users.createQueryBuilder('user')
		.where('user.isSchoolAdmin = :isSchoolAdmin', { isSchoolAdmin: true })
		.andWhere('user.adminForSchoolId = :schoolId', { schoolId: ps.schoolId })
		.andWhere('user.isDeleted = :isDeleted', { isDeleted: false })
		.orderBy('user.createdAt', 'DESC')
		.getMany();

	logger.info('Found admins:', admins.length);

	// Get user profiles for email addresses
	const adminProfiles = await UserProfiles.createQueryBuilder('profile')
		.where('profile.userId IN (:...userIds)', { 
			userIds: admins.length > 0 ? admins.map((admin: any) => admin.id) : [''] 
		})
		.getMany();

	logger.info('Found profiles:', adminProfiles.length);

	// Create a map for quick lookup
	const profileMap = new Map(adminProfiles.map((profile: any) => [profile.userId, profile]));

	// Format the response
	const adminList = admins.map((admin: any) => {
		const profile: any = profileMap.get(admin.id);
		
		return {
			id: admin.id,
			username: admin.username,
			name: admin.name || 'No name set',
			email: profile?.email || 'No email',
			createdAt: admin.createdAt.toISOString(),
			lastActiveDate: admin.lastActiveDate?.toISOString() || null,
			isActive: !admin.isLocked && !admin.isDeleted,
		};
	});

	const result = {
		admins: adminList,
		school: {
			id: school.id,
			name: school.name,
			domain: school.domain,
		},
	};
	
	logger.info('Returning result with', adminList.length, 'admins for school', school.name);
	return result;
});
