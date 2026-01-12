import define from '../../define.js';
import { Schools } from '@/models/index.js';
import { SchoolService } from '@/services/school-service.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
	
	description: 'Update an existing school',

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
		name: { type: 'string', minLength: 1, maxLength: 256 },
		location: { type: 'string', maxLength: 512 },
		description: { type: 'string', maxLength: 512 },
		websiteUrl: { type: 'string', maxLength: 512 },
		isActive: { type: 'boolean' },
	},
	required: ['schoolId'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Find the school
	const school = await Schools.findOneBy({ id: ps.schoolId });
	if (!school) {
		throw new Error('School not found');
	}

	// Update the school fields
	const updateData: any = {};
	if (ps.name !== undefined) updateData.name = ps.name;
	if (ps.location !== undefined) updateData.location = ps.location;
	if (ps.description !== undefined) updateData.description = ps.description;
	if (ps.websiteUrl !== undefined) updateData.websiteUrl = ps.websiteUrl;
	if (ps.isActive !== undefined) updateData.isActive = ps.isActive;
	
	// Add updatedAt timestamp
	updateData.updatedAt = new Date();

	await Schools.update(ps.schoolId, updateData);

	// Return the updated school
	const updatedSchool = await Schools.findOneBy({ id: ps.schoolId });
	
	return {
		id: updatedSchool!.id,
		name: updatedSchool!.name,
		domain: updatedSchool!.domain,
		type: updatedSchool!.type,
		location: updatedSchool!.location,
		description: updatedSchool!.description,
		websiteUrl: updatedSchool!.websiteUrl,
		isActive: updatedSchool!.isActive,
	};
});
