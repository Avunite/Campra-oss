import define from '../../../define.js';
import { Schools, SchoolBillings } from '@/models/index.js';
import { StripeSchoolManager } from '@/services/stripe-school-manager.js';
import { SchoolService } from '@/services/school-service.js';
import Logger from '@/services/logger.js';

const logger = new Logger('delete-school');

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
	
	description: 'Delete a school and clean up associated subscriptions',

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
			cleanupActions: {
				type: 'array',
				optional: false,
				nullable: false,
				items: {
					type: 'string'
				}
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		schoolId: { type: 'string' },
		reason: { type: 'string', maxLength: 512 },
		cancelActiveSubscriptions: { type: 'boolean' }
	},
	required: ['schoolId', 'reason'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const school = await Schools.findOneBy({ id: ps.schoolId });
	if (!school) {
		throw new Error('School not found');
	}

	const cleanupActions: string[] = [];

	try {
		// Check for active Stripe subscriptions
		const billing = await SchoolBillings.findOne({
			where: { schoolId: ps.schoolId },
			order: { createdAt: 'DESC' },
		});

		if (billing?.stripeSubscriptionId && ps.cancelActiveSubscriptions) {
			// Cancel Stripe subscription to prevent orphaned subscriptions
			try {
				const stripeManager = await StripeSchoolManager.initialize();
				
				// Get subscription details before cancellation
				const stripe = await import('stripe');
				const stripeInstance = new (stripe.default)(await stripeManager.getStripeKey(), {
					apiVersion: '2024-06-20',
				});
				
				const subscription = await stripeInstance.subscriptions.retrieve(billing.stripeSubscriptionId);
				
				// Cancel the subscription
				await stripeInstance.subscriptions.cancel(billing.stripeSubscriptionId);
				
				cleanupActions.push(`Cancelled Stripe subscription: ${billing.stripeSubscriptionId}`);
				logger.info(`Cancelled Stripe subscription ${billing.stripeSubscriptionId} for deleted school ${ps.schoolId}`);
				
				// Mark billing as cancelled
				await SchoolBillings.update({ id: billing.id }, {
					status: 'cancelled',
					metadata: {
						...billing.metadata,
						deletion_cleanup: {
							cancelled_at: new Date().toISOString(),
							cancelled_by: user.id,
							reason: ps.reason,
							subscription_status_before_cancellation: subscription.status
						}
					}
				});
				
				cleanupActions.push(`Updated billing record to cancelled status`);
				
			} catch (error: any) {
				logger.error(`Failed to cancel Stripe subscription for school ${ps.schoolId}: ${error.message}`);
				cleanupActions.push(`ERROR: Failed to cancel Stripe subscription: ${error.message}`);
			}
		} else if (billing?.stripeSubscriptionId) {
			// Subscription exists but user chose not to cancel - warn about orphaned subscription
			cleanupActions.push(`WARNING: Stripe subscription ${billing.stripeSubscriptionId} will be orphaned`);
			logger.warn(`School ${ps.schoolId} deleted but Stripe subscription ${billing.stripeSubscriptionId} was not cancelled`);
		}

		// Use SchoolService to delete the school and all associated data
		const deletionResult = await SchoolService.deleteSchool(ps.schoolId, user.id, ps.reason);
		
		// Add deletion counts to cleanup actions
		cleanupActions.push(`Deleted ${deletionResult.deletedCounts.students} students`);
		cleanupActions.push(`Deleted ${deletionResult.deletedCounts.staff} staff members`);
		cleanupActions.push(`Deleted ${deletionResult.deletedCounts.stripeCustomers} Stripe customer records`);
		cleanupActions.push(`Deleted ${deletionResult.deletedCounts.verifications} admin verification records`);
		cleanupActions.push(`Deleted ${deletionResult.deletedCounts.csvLogs} CSV import log records`);
		cleanupActions.push(`School record deleted from database (with cascaded entities)`);

		return {
			success: true,
			cleanupActions
		};

	} catch (error: any) {
		logger.error(`Error deleting school ${ps.schoolId}: ${error.message}`);
		throw new Error(`Failed to delete school: ${error.message}`);
	}
});
