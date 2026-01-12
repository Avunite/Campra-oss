import define from '../../define.js';
import { StripeSchoolManager } from '@/services/stripe-school-manager.js';

export const meta = {
	tags: ['stripe'],
	requireCredential: true,
	requireSchoolAdmin: true,
	
	description: 'Create setup intent for payment method collection',
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		schoolId: { type: 'string' },
	},
	required: ['schoolId'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	try {
		const stripeManager = await StripeSchoolManager.initialize();
		
		// Get or create stripe customer
		let customerId = await stripeManager.getSchoolStripeCustomerId(ps.schoolId);
		if (!customerId) {
			// Get school info to create customer
			const { Schools } = await import('@/models/index.js');
			const school = await Schools.findOneBy({ id: ps.schoolId });
			if (!school) {
				throw new Error('School not found');
			}
			customerId = await stripeManager.createSchoolCustomer(school);
		}
		
		// Create setup intent for payment method collection
		const setupIntent = await stripeManager.createPaymentMethodSetupIntent(customerId);
		
		return {
			success: true,
			client_secret: setupIntent.client_secret,
			customer_id: customerId,
		};
	} catch (error: any) {
		throw new Error(`Failed to create setup intent: ${error.message}`);
	}
});
