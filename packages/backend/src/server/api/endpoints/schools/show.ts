import define from '../../define.js';
import { Schools, DriveFiles } from '@/models/index.js';

export const meta = {
	tags: ['schools'],
	requireCredential: true,
	
	description: 'Get school information (school admin only)',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			id: {
				type: 'string',
				optional: false,
				nullable: false,
				format: 'campra:id',
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
			location: {
				type: 'string',
				optional: true,
				nullable: true,
			},
			description: {
				type: 'string',
				optional: true,
				nullable: true,
			},
			logoUrl: {
				type: 'string',
				optional: true,
				nullable: true,
			},
			logoId: {
				type: 'string',
				optional: true,
				nullable: true,
			},
			websiteUrl: {
				type: 'string',
				optional: true,
				nullable: true,
			},
			isActive: {
				type: 'boolean',
				optional: false,
				nullable: false,
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
	// Check if user is school admin for this school
	if (!user.isSchoolAdmin || user.adminForSchoolId !== ps.schoolId) {
		throw new Error('Access denied: School admin access required');
	}

	// Find the school
	const school = await Schools.findOneBy({ id: ps.schoolId });
	if (!school) {
		throw new Error('School not found');
	}

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
		location: school.location,
		description: school.description,
		logoUrl: logoUrl,
		logoId: school.logoId,
		websiteUrl: school.websiteUrl,
		isActive: school.isActive,
	};
});
