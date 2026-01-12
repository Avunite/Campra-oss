import define from '../../define.js';
import { Schools } from '@/models/index.js';
import { SchoolService } from '@/services/school-service.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
	
	description: 'Create a new school with admin email verification',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			school: {
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
					createdAt: {
						type: 'string',
						optional: false,
						nullable: false,
						format: 'date-time',
					},
				},
			},
			verificationSent: {
				type: 'boolean',
				optional: false,
				nullable: false,
			},
		},
	},

	errors: {
		invalidDomain: {
			message: 'Invalid domain format',
			code: 'INVALID_DOMAIN',
			id: 'school-admin-005',
		},
		domainExists: {
			message: 'A school with this domain already exists',
			code: 'DOMAIN_EXISTS',
			id: 'school-admin-006',
		},
		invalidEmail: {
			message: 'Invalid email format',
			code: 'INVALID_EMAIL',
			id: 'school-admin-007',
		},
		invalidCoordinates: {
			message: 'Invalid coordinates format',
			code: 'INVALID_COORDINATES',
			id: 'school-admin-008',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		name: { type: 'string', minLength: 1, maxLength: 256 },
		domain: { type: 'string', minLength: 1, maxLength: 128 },
		adminEmail: { type: 'string', maxLength: 256 },
		adminName: { type: 'string', minLength: 1, maxLength: 100 },
		type: { 
			type: 'string', 
			enum: ['university', 'college', 'k12', 'trade_school', 'private_school'],
			default: 'university'
		},
		location: { type: 'string', maxLength: 512 },
		description: { type: 'string', maxLength: 512 },
		logoUrl: { type: 'string', maxLength: 512 },
		websiteUrl: { type: 'string', maxLength: 512 },
		coordinates: { 
			type: 'object',
			properties: {
				latitude: { type: 'number', minimum: -90, maximum: 90 },
				longitude: { type: 'number', minimum: -180, maximum: 180 }
			},
			required: ['latitude', 'longitude'],
		},
	},
	required: ['name', 'domain', 'adminEmail', 'adminName'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Validate domain format
	const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
	if (!domainRegex.test(ps.domain)) {
		throw new Error('INVALID_DOMAIN');
	}

	// Validate email format (additional validation beyond JSON schema)
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(ps.adminEmail)) {
		throw new Error('INVALID_EMAIL');
	}

	// Validate coordinates if provided
	if (ps.coordinates) {
		if (typeof ps.coordinates.latitude !== 'number' || 
			typeof ps.coordinates.longitude !== 'number' ||
			ps.coordinates.latitude < -90 || ps.coordinates.latitude > 90 ||
			ps.coordinates.longitude < -180 || ps.coordinates.longitude > 180) {
			throw new Error('INVALID_COORDINATES');
		}
	}

	// Check if domain already exists
	const existingSchool = await Schools.findOne({
		where: { domain: ps.domain.toLowerCase() },
	});

	if (existingSchool) {
		throw new Error('DOMAIN_EXISTS');
	}

	try {
		// Create the school with admin verification
		const { school, verificationSent } = await SchoolService.createSchoolWithAdmin({
			name: ps.name,
			domain: ps.domain,
			type: ps.type,
			location: ps.location,
			description: ps.description,
			logoUrl: ps.logoUrl,
			websiteUrl: ps.websiteUrl,
			coordinates: ps.coordinates,
			adminEmail: ps.adminEmail,
			adminName: ps.adminName,
		});

		// Create initial billing record
		await SchoolService.createInitialBilling(school.id);

		return {
			school: {
				id: school.id,
				name: school.name,
				domain: school.domain,
				type: school.type,
				location: school.location,
				description: school.description,
				logoUrl: school.logoUrl,
				websiteUrl: school.websiteUrl,
				isActive: school.isActive,
				createdAt: school.createdAt.toISOString(),
			},
			verificationSent,
		};
	} catch (error: any) {
		if (error.message === 'Invalid domain format') {
			throw new Error('INVALID_DOMAIN');
		}
		if (error.message === 'A school with this domain already exists') {
			throw new Error('DOMAIN_EXISTS');
		}
		
		// Re-throw other errors
		throw error;
	}
});