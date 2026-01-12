import define from '../../define.js';
import { Schools, DriveFiles } from '@/models/index.js';

export const meta = {
	tags: ['schools'],
	requireCredential: true,
	
	description: 'Update school profile information (school admin only)',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			success: {
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
		description: { type: 'string', maxLength: 512 },
		websiteUrl: { type: 'string', maxLength: 512 },
		logoId: { type: 'string', format: 'campra:id' },
		location: { type: 'string', maxLength: 256 },
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

	// Handle logoId if provided (drive file)
	if (ps.logoId !== undefined) {
		if (ps.logoId) {
			// Validate the drive file
			const logoFile = await DriveFiles.findOneBy({ id: ps.logoId });
			if (!logoFile || logoFile.userId !== user.id) {
				throw new Error('Invalid logo file');
			}
			if (!logoFile.type.startsWith('image/')) {
				throw new Error('Logo must be an image file');
			}
		}
	}

	// Update the school fields
	const updateData: any = {};
	if (ps.name !== undefined) updateData.name = ps.name;
	if (ps.description !== undefined) updateData.description = ps.description;
	if (ps.websiteUrl !== undefined) updateData.websiteUrl = ps.websiteUrl;
	
	// Handle logo fields - clear the other when one is set
	if (ps.logoUrl !== undefined) {
		updateData.logoUrl = ps.logoUrl;
		updateData.logoId = null; // Clear logoId when setting logoUrl
	}
	if (ps.logoId !== undefined) {
		updateData.logoId = ps.logoId;
		updateData.logoUrl = null; // Clear logoUrl when setting logoId
	}
	
	if (ps.location !== undefined) updateData.location = ps.location;
	
	// Add updatedAt timestamp
	updateData.updatedAt = new Date();

	await Schools.update(ps.schoolId, updateData);

	return {
		success: true,
	};
});
