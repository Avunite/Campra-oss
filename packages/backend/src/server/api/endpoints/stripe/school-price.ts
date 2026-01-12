import define from '../../define.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { StripePriceFetcher } from '@/services/stripe/price-fetcher.js';

export const meta = {
	tags: ['stripe'],
	requireCredential: true,
	requireAdmin: true,
	
	description: 'Get current school subscription pricing information',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			pricePerStudentAnnual: {
				type: 'number',
				optional: false,
				nullable: false,
			},
			currency: {
				type: 'string',
				optional: false,
				nullable: false,
			},
			billingInterval: {
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
	// Fetch current pricing from Stripe
	const priceInfo = await StripePriceFetcher.getPrice();
	
	// Return current school pricing configuration
	return {
		pricePerStudentAnnual: priceInfo.pricePerStudentPerYear,
		currency: priceInfo.currency.toLowerCase(),
		billingInterval: priceInfo.billingCycle === 'yearly' ? 'year' : priceInfo.billingCycle,
	};
});
