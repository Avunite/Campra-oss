import define from '../../define.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { StripePriceFetcher } from '@/services/stripe/price-fetcher.js';

export const meta = {
	tags: ['stripe'],
	requireCredential: true,
	requireAdmin: true,
	
	description: 'Check Stripe configuration status for school billing',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			configured: {
				type: 'boolean',
				optional: false,
				nullable: false,
			},
			hasApiKey: {
				type: 'boolean',
				optional: false,
				nullable: false,
			},
			hasWebhookSecret: {
				type: 'boolean',
				optional: false,
				nullable: false,
			},
			schoolBillingEnabled: {
				type: 'boolean',
				optional: false,
				nullable: false,
			},
			defaultRate: {
				type: 'number',
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
	const instance = await fetchMeta();
	
	const hasApiKey = !!instance.stripeKey;
	const hasWebhookSecret = !!instance.stripeWebhookSecret;
	const configured = hasApiKey && hasWebhookSecret;
	
	// Get current default rate from Stripe
	const defaultRate = await StripePriceFetcher.getPriceAmount();
	
	return {
		configured,
		hasApiKey,
		hasWebhookSecret,
		schoolBillingEnabled: configured, // Only enable school billing if fully configured
		defaultRate,
	};
});
