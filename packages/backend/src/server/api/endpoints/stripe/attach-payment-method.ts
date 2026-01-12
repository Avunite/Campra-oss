import define from '../../define.js';
import { StripeSchoolManager } from '@/services/stripe-school-manager.js';

export const meta = {
	tags: ['stripe'],
	requireCredential: true,
	requireSchoolAdmin: true,
	
	description: 'Attach payment method to school subscription',
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		schoolId: { type: 'string' },
		paymentMethodId: { type: 'string' },
	},
	required: ['schoolId', 'paymentMethodId'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	try {
		const stripeManager = await StripeSchoolManager.initialize();
		
		// Find the school's subscription
		const { SchoolBillings } = await import('@/models/index.js');
		const billing = await SchoolBillings.findOne({
			where: { schoolId: ps.schoolId },
			order: { createdAt: 'DESC' },
		});
		
		if (!billing?.stripeSubscriptionId) {
			throw new Error('No subscription found for this school');
		}
		
		// Attach payment method to subscription
		await stripeManager.attachPaymentMethodToSubscription(
			billing.stripeSubscriptionId, 
			ps.paymentMethodId
		);
		
		// Try to pay the first invoice if it exists
		const stripe = await import('stripe');
		const stripeInstance = new (stripe.default)(await stripeManager.getStripeKey(), {
			apiVersion: '2024-06-20',
		});
		
		const subscription = await stripeInstance.subscriptions.retrieve(billing.stripeSubscriptionId, {
			expand: ['latest_invoice'],
		});
		
		if (subscription.latest_invoice && typeof subscription.latest_invoice === 'object' && subscription.latest_invoice.status === 'open') {
			await stripeInstance.invoices.pay(subscription.latest_invoice.id);
		}
		
		return {
			success: true,
			subscription_status: subscription.status,
		};
	} catch (error: any) {
		throw new Error(`Failed to attach payment method: ${error.message}`);
	}
});
