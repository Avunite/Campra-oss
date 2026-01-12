import define from '../../../define.js';
import { Schools } from '@/models/index.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
	
	description: 'Activate school subscription for free (platform admin only)',

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
			message: {
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
		schoolId: {
			type: 'string',
		},
		action: {
			type: 'string',
			enum: ['activate', 'deactivate', 'suspend', 'revoke'],
		},
		reason: {
			type: 'string',
			nullable: true,
		},
	},
	required: ['schoolId', 'action'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Double-check admin status
	if (!user.isAdmin) {
		throw new ApiError({
			message: 'Access denied: Platform administrator access required',
			code: 'ACCESS_DENIED',
			id: 'platform-admin-required-001',
		});
	}

	const school = await Schools.findOneBy({ id: ps.schoolId });
	if (!school) {
		throw new ApiError({
			message: 'School not found',
			code: 'SCHOOL_NOT_FOUND',
			id: 'school-not-found-001',
		});
	}

	let newStatus: string;
	let message: string;

	switch (ps.action) {
		case 'activate':
			newStatus = 'active';
			message = `School "${school.name}" has been activated for free by platform admin`;
			break;
		case 'deactivate':
			newStatus = 'inactive';
			message = `School "${school.name}" has been deactivated by platform admin`;
			break;
		case 'suspend':
			newStatus = 'suspended';
			message = `School "${school.name}" has been suspended by platform admin`;
			break;
		case 'revoke':
			newStatus = 'inactive';
			message = `School "${school.name}" free access has been revoked by platform admin`;
			break;
		default:
			throw new ApiError({
				message: 'Invalid action specified',
				code: 'INVALID_ACTION',
				id: 'invalid-action-001',
			});
	}

	// Update school status
	let updateData: any = {
		subscriptionStatus: newStatus,
	};

	if (ps.action === 'revoke') {
		// Check if school has a paid subscription despite free access
		const hasPaidSubscription = school.metadata?.paidSubscriptionDespiteFree;
		
		if (hasPaidSubscription) {
			// School has a paid subscription - revoke won't affect them
			const { adminOverride, adminOverrideReason, adminOverrideDate, adminOverrideBy, freeActivation, ...remainingMetadata } = school.metadata || {};
			updateData.metadata = {
				...remainingMetadata,
				lastAdminAction: {
					action: 'revoke',
					reason: ps.reason || 'Platform admin revocation',
					date: new Date().toISOString(),
					by: user.id,
					note: 'School has paid subscription - access maintained',
					previousOverride: {
						adminOverride,
						adminOverrideReason,
						adminOverrideDate,
						adminOverrideBy,
						freeActivation,
					},
				},
			};
			// Don't change subscription status - they have paid access
			updateData.subscriptionStatus = 'active';
			message = `School "${school.name}" free access revoked, but they have a paid subscription so access is maintained`;
		} else {
			// Standard revocation - no paid subscription
			const { adminOverride, adminOverrideReason, adminOverrideDate, adminOverrideBy, freeActivation, ...remainingMetadata } = school.metadata || {};
			updateData.metadata = {
				...remainingMetadata,
				lastAdminAction: {
					action: 'revoke',
					reason: ps.reason || 'Platform admin revocation',
					date: new Date().toISOString(),
					by: user.id,
					previousOverride: {
						adminOverride,
						adminOverrideReason,
						adminOverrideDate,
						adminOverrideBy,
						freeActivation,
					},
				},
			};
		}
	} else {
		// For other actions, add admin override flag
		updateData.metadata = {
			...school.metadata,
			adminOverride: true,
			adminOverrideReason: ps.reason || `Platform admin ${ps.action}`,
			adminOverrideDate: new Date().toISOString(),
			adminOverrideBy: user.id,
		};
	}

	await Schools.update({ id: ps.schoolId }, updateData);

	// Log the action for audit purposes
	const logMessage = `Platform admin ${user.username} (${user.id}) ${ps.action}d school ${school.name} (${school.id})`;
	// Note: Add proper logger import if needed

	return {
		success: true,
		message,
	};
});
