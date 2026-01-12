import define from '../../define.js';
import { Schools } from '@/models/index.js';
import { SchoolService } from '@/services/school-service.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
	
	description: 'Create a new school for the platform',

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
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		name: { type: 'string', minLength: 1, maxLength: 256 },
		domain: { type: 'string', minLength: 1, maxLength: 128 },
		type: { 
			type: 'string', 
			enum: ['university', 'college', 'k12', 'trade_school', 'private_school'],
			default: 'university'
		},
		location: { type: 'string', maxLength: 512 },
		description: { type: 'string', maxLength: 512 },
		logoUrl: { type: 'string', maxLength: 512 },
		websiteUrl: { type: 'string', maxLength: 512 },
	},
	required: ['name', 'domain'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Validate domain format
	const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
	if (!domainRegex.test(ps.domain)) {
		throw new Error('Invalid domain format');
	}

	// Check if domain already exists
	const existingSchool = await Schools.findOne({
		where: { domain: ps.domain.toLowerCase() },
	});

	if (existingSchool) {
		throw new Error('A school with this domain already exists');
	}

	// Create the school
	const school = await SchoolService.createSchool({
		name: ps.name,
		domain: ps.domain,
		type: ps.type,
		location: ps.location,
		description: ps.description,
		logoUrl: ps.logoUrl,
		websiteUrl: ps.websiteUrl,
	});

	// Create initial billing record
	await SchoolService.createInitialBilling(school.id);

	return {
		id: school.id,
		name: school.name,
		domain: school.domain,
		type: school.type,
		location: school.location,
		description: school.description,
		logoUrl: school.logoUrl,
		websiteUrl: school.websiteUrl,
		isActive: school.isActive,
		createdAt: school.createdAt,
	};
});
