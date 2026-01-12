import define from '../../define.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { StripePriceFetcher } from '@/services/stripe/price-fetcher.js';

export const meta = {
	tags: ['stripe', 'school'],
	requireCredential: false,
	
	description: 'Get school pricing information',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			pricePerStudentPerYear: {
				type: 'number',
				optional: false,
				nullable: false,
			},
			currency: {
				type: 'string',
				optional: false,
				nullable: false,
			},
			billingCycle: {
				type: 'string',
				optional: false,
				nullable: false,
			},
			stripePriceId: {
				type: 'string',
				optional: false,
				nullable: true,
			},
			description: {
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

export default define(meta, paramDef, async () => {
	const instance = await fetchMeta();
	
	// Fetch current pricing from Stripe
	const priceInfo = await StripePriceFetcher.getPrice();
	
	return {
		pricePerStudentPerYear: priceInfo.pricePerStudentPerYear,
		currency: priceInfo.currency,
		billingCycle: priceInfo.billingCycle,
		stripePriceId: instance.stripeSchoolPriceId,
		description: 'Annual subscription for schools. Only students are counted - staff are excluded from billing.',
	};
});
