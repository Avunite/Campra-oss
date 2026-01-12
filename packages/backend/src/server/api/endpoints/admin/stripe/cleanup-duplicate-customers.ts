import define from '../../../define.js';
import { StripeSchoolManager } from '@/services/stripe-school-manager.js';

export const meta = {
	tags: ['admin', 'stripe'],
	requireCredential: true,
	requireAdmin: true,

	description: 'Clean up duplicate Stripe customers for a school',

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
			result: {
				type: 'object',
				optional: false,
				nullable: false,
				properties: {
					deleted: {
						type: 'array',
						items: { type: 'string' },
						optional: false,
						nullable: false,
					},
					kept: {
						type: 'string',
						optional: false,
						nullable: false,
					},
				},
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
	const stripeManager = await StripeSchoolManager.initialize();

	try {
		const result = await stripeManager.customerService.cleanupDuplicateCustomers(ps.schoolId);

		return {
			success: true,
			message: `Cleaned up duplicate customers for school ${ps.schoolId}. Deleted: ${result.deleted.join(', ')}, Kept: ${result.kept}`,
			result,
		};
	} catch (error: any) {
		throw new Error(`Failed to cleanup duplicate customers: ${error.message}`);
	}
});