import define from '../../../define.js';
import { Schools, Users, DriveFiles } from '@/models/index.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
	
	description: 'List all schools (platform admin only)',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			schools: {
				type: 'array',
				optional: false,
				nullable: false,
				items: {
					type: 'object',
					optional: false,
					nullable: false,
					properties: {
						id: {
							type: 'string',
							optional: false,
							nullable: false,
						},
						name: {
							type: 'string',
							optional: false,
							nullable: false,
						},
						domain: {
							type: 'string',
							optional: false,
							nullable: false,
						},
						type: {
							type: 'string',
							optional: false,
							nullable: false,
						},
						logoUrl: {
							type: 'string',
							optional: true,
							nullable: true,
						},
						subscriptionStatus: {
							type: 'string',
							optional: false,
							nullable: false,
						},
						studentCount: {
							type: 'number',
							optional: true,
							nullable: false,
						},
						createdAt: {
							type: 'string',
							optional: false,
							nullable: false,
						},
						metadata: {
							type: 'object',
							optional: true,
							nullable: true,
						},
					},
				},
			},
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
			default: 50,
		},
		offset: {
			type: 'integer',
			minimum: 0,
			default: 0,
		},
		type: {
			type: 'string',
			nullable: true,
		},
		status: {
			type: 'string',
			nullable: true,
		},
		search: {
			type: 'string',
			nullable: true,
		},
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Double-check admin status
	if (!user.isAdmin) {
		throw new Error('Access denied: Platform administrator access required');
	}

	let query = Schools.createQueryBuilder('school');

	// Apply filters
	if (ps.type) {
		query = query.andWhere('school.type = :type', { type: ps.type });
	}

	if (ps.status) {
		query = query.andWhere('school.subscriptionStatus = :status', { status: ps.status });
	}

	if (ps.search) {
		query = query.andWhere(
			'(school.name ILIKE :search OR school.domain ILIKE :search)',
			{ search: `%${ps.search}%` }
		);
	}

	// Get schools 
	const schools = await query
		.orderBy('school.createdAt', 'DESC')
		.skip(ps.offset)
		.take(ps.limit)
		.getMany();

	// Format response
	const formattedSchools = await Promise.all(schools.map(async (school) => {
		// Count students for this school
		const studentCount = await Users.count({
			where: { schoolId: school.id },
		});

		// Resolve logo URL from logoId if present
		let logoUrl = school.logoUrl;
		if (school.logoId && !logoUrl) {
			try {
				const logoFile = await DriveFiles.findOneBy({ id: school.logoId });
				if (logoFile) {
					logoUrl = await DriveFiles.getSecureUrl(logoFile, false) || logoFile.url;
				}
			} catch (error) {
				// If drive file doesn't exist or can't be accessed, logoUrl will remain null
			}
		}

		return {
			id: school.id,
			name: school.name,
			domain: school.domain,
			type: school.type,
			logoUrl: logoUrl,
			subscriptionStatus: school.subscriptionStatus || 'inactive',
			studentCount: studentCount,
			createdAt: school.createdAt.toISOString(),
			metadata: school.metadata || null,
		};
	}));

	return {
		schools: formattedSchools,
	};
});
