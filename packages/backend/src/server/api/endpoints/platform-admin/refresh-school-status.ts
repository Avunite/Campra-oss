import define from '../../define.js';
import { Schools, SchoolBillings } from '@/models/index.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
	
	description: 'Refresh a school\'s subscription status based on billing records',

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
			oldStatus: {
				type: 'string',
				optional: false,
				nullable: false,
			},
			newStatus: {
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
		schoolId: { type: 'string', format: 'campra:id' },
	},
	required: ['schoolId'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const school = await Schools.findOneBy({ id: ps.schoolId });
	if (!school) {
		throw new Error('School not found');
	}

	const oldStatus = school.subscriptionStatus || 'pending';

	// Get latest billing record
	const billing = await SchoolBillings.findOne({
		where: { schoolId: ps.schoolId },
		order: { createdAt: 'DESC' },
	});

	let newStatus = 'pending';
	
	if (billing) {
		if (billing.status === 'active') {
			newStatus = 'active';
		} else if (billing.status === 'suspended' || billing.status === 'past_due') {
			newStatus = 'suspended';
		} else {
			newStatus = billing.status;
		}
	}

	// Check for admin override (free access)
	const isFree = (school.metadata?.adminOverride || school.metadata?.freeActivation) && 
	               !school.metadata?.paidSubscriptionDespiteFree;
	
	if (isFree && billing?.status !== 'suspended') {
		newStatus = 'active';
	}

	// Update school status if it changed
	if (newStatus !== oldStatus) {
		await Schools.update({ id: ps.schoolId }, {
			subscriptionStatus: newStatus,
		});
	}

	return {
		success: true,
		oldStatus,
		newStatus,
	};
});
