import define from '../../define.js';
import { StripeSchoolManager } from '@/services/stripe-school-manager.js';

export const meta = {
	tags: ['stripe'],
	requireCredential: true,
	
	description: 'Create school subscription (school admin only)',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {		subscriptionId: {
			type: 'string',
			optional: true,
			nullable: true,
		},
		clientSecret: {
			type: 'string',
			optional: true,
			nullable: true,
		},
		status: {
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
		paymentMethodId: {
			type: 'string',
			nullable: true,
		},
		upgradeFromFree: {
			type: 'boolean',
			default: false,
		},
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Check if user is school admin
	if (!user.isSchoolAdmin || !user.adminForSchoolId) {
		throw new Error('Access denied: School admin access required');
	}

	const schoolId = user.adminForSchoolId;
	const stripeManager = await StripeSchoolManager.initialize();

	try {
		const result = await stripeManager.createSchoolSubscription(
			schoolId,
			ps.paymentMethodId || undefined,
			ps.upgradeFromFree || false
		);

		// Handle both free schools (no subscription) and paid schools
		if (result.subscription) {
			return {
				subscriptionId: result.subscription.id,
				clientSecret: result.subscription.latest_invoice?.payment_intent?.client_secret || null,
				status: result.subscription.status,
			};
		} else {
			// Free school - no Stripe subscription created
			return {
				subscriptionId: null,
				clientSecret: null,
				status: 'active', // Free schools are automatically active
			};
		}
	} catch (error: any) {
		throw new Error(`Failed to create subscription: ${error.message}`);
	}
});
