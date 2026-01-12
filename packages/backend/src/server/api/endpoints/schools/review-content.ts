import define from '../../define.js';
import { ContentFlags } from '@/models/index.js';

export const meta = {
	tags: ['schools'],
	requireCredential: true,
	
	description: 'Review flagged content (school admin only)',

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
		flagId: {
			type: 'string',
		},
		action: {
			type: 'string',
			enum: ['approve', 'remove', 'escalate'],
		},
		reason: {
			type: 'string',
			nullable: true,
		},
	},
	required: ['flagId', 'action'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Check if user is school admin
	if (!user.isSchoolAdmin || !user.adminForSchoolId) {
		throw new Error('Access denied: School admin access required');
	}

	const schoolId = user.adminForSchoolId;

	// Find the flag and verify it belongs to this school
	const flag = await ContentFlags.findOne({
		where: {
			id: ps.flagId,
			schoolId: schoolId,
		},
	});

	if (!flag) {
		throw new Error('Content flag not found or access denied');
	}

	// Update flag based on action
	let newStatus: string;
	switch (ps.action) {
		case 'approve':
			newStatus = 'approved';
			break;
		case 'remove':
			newStatus = 'removed';
			break;
		case 'escalate':
			newStatus = 'escalated';
			break;
		default:
			throw new Error('Invalid action');
	}

	await ContentFlags.update(
		{ id: ps.flagId },
		{
			status: newStatus,
			reviewedAt: new Date(),
			reviewedBy: user.id,
			reviewReason: ps.reason || null,
		}
	);

	return { success: true };
});
