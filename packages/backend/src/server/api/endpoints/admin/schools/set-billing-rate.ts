import define from '../../../define.js';
import { Schools } from '@/models/index.js';
import { StripeSchoolManager } from '@/services/stripe-school-manager.js';
import { StripePriceFetcher } from '@/services/stripe/price-fetcher.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
	
	description: 'Set custom billing rate or discount for a school',

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
			school: {
				type: 'object',
				optional: false,
				nullable: false,
				properties: {
					id: { type: 'string' },
					name: { type: 'string' },
					customRate: { type: 'number', nullable: true },
					discountPercentage: { type: 'number', nullable: true },
					effectiveRate: { type: 'number' },
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		schoolId: { type: 'string' },
		billingType: { 
			type: 'string', 
			enum: ['standard', 'custom', 'discount', 'free'] 
		},
		customRate: { type: 'number', minimum: 0.01, maximum: 100 }, // Minimum $0.01
		discountPercentage: { type: 'number', minimum: 0, maximum: 99 }, // Maximum 99% discount
		reason: { type: 'string', maxLength: 512 },
	},
	required: ['schoolId', 'billingType', 'reason'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const school = await Schools.findOneBy({ id: ps.schoolId });
	if (!school) {
		throw new Error('School not found');
	}

	// Initialize metadata if it doesn't exist
	if (!school.metadata) {
		school.metadata = {};
	}

	// Get standard rate from Stripe
	const standardRate = await StripePriceFetcher.getPriceAmount();
	let effectiveRate = standardRate;

	switch (ps.billingType) {
		case 'standard':
			// Remove custom billing settings
			delete school.metadata.customBillingRate;
			delete school.metadata.discountPercentage;
			delete school.metadata.adminOverride;
			effectiveRate = standardRate;
			break;

		case 'custom':
			if (!ps.customRate && ps.customRate !== 0) {
				throw new Error('Custom rate is required');
			}
			// Validate custom rate is not zero or negative
			if (ps.customRate <= 0) {
				throw new Error('Custom rate must be greater than $0. Use "free" billing type for no cost.');
			}
			// Validate that the rate won't round to zero in cents
			const customRateInCents = Math.round(ps.customRate * 100);
			if (customRateInCents <= 0) {
				throw new Error(`Custom rate $${ps.customRate} is too small and rounds to $0. Minimum rate is $0.01 per student.`);
			}
			school.metadata.customBillingRate = ps.customRate;
			delete school.metadata.discountPercentage;
			delete school.metadata.adminOverride;
			effectiveRate = ps.customRate;
			break;

		case 'discount':
			if (!ps.discountPercentage && ps.discountPercentage !== 0) {
				throw new Error('Discount percentage is required');
			}
			if (ps.discountPercentage < 0) {
				throw new Error('Discount percentage cannot be negative.');
			}
			if (ps.discountPercentage >= 100) {
				throw new Error('Discount percentage cannot be 100% or higher. Use "free" billing type for no cost.');
			}
			
			const discountedRate = standardRate * (1 - ps.discountPercentage / 100);
			
			// Validate the discounted rate won't round to zero in cents
			const discountedRateInCents = Math.round(discountedRate * 100);
			if (discountedRateInCents <= 0) {
				throw new Error(`Discount of ${ps.discountPercentage}% results in a rate too small (rounds to $0). Maximum discount is 99% ($0.01/student minimum).`);
			}
			
			// Additional safety: ensure rate is at least $0.01
			if (discountedRate < 0.01) {
				throw new Error(`Discount of ${ps.discountPercentage}% results in rate below minimum. Rate would be $${discountedRate.toFixed(4)}, minimum is $0.01/student.`);
			}
			
			school.metadata.discountPercentage = ps.discountPercentage;
			delete school.metadata.customBillingRate;
			delete school.metadata.adminOverride;
			effectiveRate = standardRate * (1 - ps.discountPercentage / 100);
			break;

		case 'free':
			school.metadata.adminOverride = true;
			school.metadata.freeActivation = true;
			delete school.metadata.customBillingRate;
			delete school.metadata.discountPercentage;
			effectiveRate = 0;
			break;

		default:
			throw new Error('Invalid billing type');
	}

	// Store admin action metadata
	school.metadata.lastBillingUpdate = {
		timestamp: new Date().toISOString(),
		adminId: user.id,
		reason: ps.reason || 'Admin billing configuration',
		billingType: ps.billingType,
	};

	// Use update() instead of save() to avoid coordinates serialization issues
	// save() would try to re-save the coordinates field which causes PostGIS point errors
	await Schools.update({ id: school.id }, { metadata: school.metadata });

	// Update active Stripe subscription if it exists
	try {
		const stripeManager = await StripeSchoolManager.initialize();
		await stripeManager.updateSubscriptionRate(school.id);
	} catch (error: any) {
		// Don't throw - billing config was saved successfully
		// Just log the warning for admin review
		console.warn(`Failed to update Stripe subscription for school ${school.id}:`, error.message);
	}

	return {
		success: true,
		school: {
			id: school.id,
			name: school.name,
			customRate: school.metadata.customBillingRate || null,
			discountPercentage: school.metadata.discountPercentage || null,
			effectiveRate,
		},
	};
});
