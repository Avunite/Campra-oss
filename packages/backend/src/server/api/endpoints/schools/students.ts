import define from '../../define.js';
import { Users } from '@/models/index.js';

export const meta = {
	tags: ['schools'],
	requireCredential: true,
	
	description: 'Get students and staff from school (school admin only)',

	res: {
		type: 'array',
		optional: false,
		nullable: false,
		items: {
			type: 'object',
			optional: false,
			nullable: false,
			ref: 'User',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
		offset: { type: 'integer', minimum: 0, default: 0 },
		search: { type: 'string', maxLength: 256 },
		includeAlumni: { type: 'boolean', default: false },
		includeStaff: { type: 'boolean', default: true }, // Include teachers/staff by default
		userType: { 
			type: 'string', 
			enum: ['all', 'students', 'staff'], 
			default: 'all' 
		}, // Filter by user type: students (isTeacher=false, isSchoolAdmin=false), staff (isTeacher=true OR isSchoolAdmin=true), or all
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Check if user is school admin
	if (!user.isSchoolAdmin || !user.adminForSchoolId) {
		throw new Error('Access denied: School admin access required');
	}

	const schoolId = user.adminForSchoolId;

	// Build query
	const query = Users.createQueryBuilder('user')
		.where('user.schoolId = :schoolId', { schoolId });

	// Filter alumni if not included
	if (!ps.includeAlumni) {
		query.andWhere('user.isAlumni = false');
	}

	// Filter by user type (students vs teachers/staff)
	switch (ps.userType) {
		case 'students':
			// Students are users who are not teachers and not school admins
			query.andWhere('user.isTeacher = false')
				 .andWhere('user.isSchoolAdmin = false');
			break;
		case 'staff':
			// Staff includes both teachers and school admins
			query.andWhere('(user.isTeacher = true OR user.isSchoolAdmin = true)');
			break;
		case 'all':
		default:
			// Include everyone from the school
			if (!ps.includeStaff) {
				// If staff is excluded, only show students
				query.andWhere('user.isTeacher = false')
					 .andWhere('user.isSchoolAdmin = false');
			}
			break;
	}

	// Add search filter
	if (ps.search) {
		query.andWhere(
			'(user.username ILIKE :search OR user.name ILIKE :search OR user.major ILIKE :search)',
			{ search: `%${ps.search}%` }
		);
	}

	// Apply pagination and ordering
	query
		.orderBy('user.createdAt', 'DESC')
		.skip(ps.offset)
		.take(ps.limit);

	const students = await query.getMany();

	// Pack users with detail
	return await Users.packMany(students, user, { detail: true });
});
