import define from '../../define.js';
import { Users } from '@/models/index.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
	
	description: 'Remove school administrator privileges from a user',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			success: { type: 'boolean' },
			message: { type: 'string' },
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'campra:id' },
		reason: { type: 'string', maxLength: 512 },
	},
	required: ['userId'],
} as const;

export default define(meta, paramDef, async (ps, adminUser) => {
	// Find the user
	const user = await Users.findOneBy({ id: ps.userId });
	if (!user) {
		throw new Error('User not found');
	}

	// Verify user is actually a school admin
	if (!user.isSchoolAdmin) {
		throw new Error('User is not a school administrator');
	}

	// Prevent removing admin privileges from the platform admin
	if (user.isAdmin) {
		throw new Error('Cannot remove admin privileges from platform administrators');
	}

	// Store the school info for logging
	const schoolId = user.adminForSchoolId;

	// Remove school admin privileges
	await Users.update({ id: ps.userId }, {
		isSchoolAdmin: false,
		adminForSchoolId: null,
		// Keep other properties intact
	});

	const reason = ps.reason || 'Platform admin action';
	
	return {
		success: true,
		message: `School admin privileges removed from ${user.username} (${user.name}). Reason: ${reason}`,
	};
});
