import define from '../../define.js';
import Stripe from 'stripe';
import { fetchMeta } from '@/misc/fetch-meta.js';

export const meta = {
	tags: ['stripe'],
	requireCredential: true,
	
	description: 'Create setup intent for payment method collection (school admin only)',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			client_secret: {
				type: 'string',
				optional: false,
				nullable: false,
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Check if user is school admin
	if (!user.isSchoolAdmin || !user.adminForSchoolId) {
		throw new Error('Access denied: School admin access required');
	}

	// Check if user or school is demo - return mock response
	if (user.isDemo) {
		return {
			client_secret: 'demo_setup_intent_client_secret',
		};
	}

	const meta = await fetchMeta();
	if (!meta.stripeKey) {
		throw new Error('Stripe not configured');
	}

	const stripe = new Stripe(meta.stripeKey, {
		apiVersion: '2024-06-20',
	});

	try {
		const setupIntent = await stripe.setupIntents.create({
			metadata: {
				schoolId: user.adminForSchoolId,
				type: 'school_payment_method',
			},
		});

		return {
			client_secret: setupIntent.client_secret,
		};
	} catch (error: any) {
		throw new Error(`Failed to create setup intent: ${error.message}`);
	}
});
