import { fetchMeta } from '@/misc/fetch-meta.js';
import { Users, Schools, SchoolBillings } from '@/models/index.js';
import Stripe from 'stripe';
import Logger from '@/services/logger.js';
import define from '../../define.js';
import { ApiError } from '../../error.js';

const logger = new Logger('stripe-manage');

export const meta = {
  tags: ['account'],
  requireCredential: true,
  errors: {
    'STRIPE_NOT_CONFIGURED': {
      message: 'Stripe is not configured properly',
      code: 'STRIPE_NOT_CONFIGURED',
      id: 'c0c9f693-bed3-4543-88aa-5a87e7bee9c3',
    },
    'NO_ACTIVE_SUBSCRIPTION': {
      message: 'No active subscription found',
      code: 'NO_ACTIVE_SUBSCRIPTION',
      id: 'd0e8f123-4567-89ab-cdef-123456789abc',
    },
    'INVALID_SUBSCRIPTION_ACTION': {
      message: 'Invalid subscription action specified',
      code: 'INVALID_SUBSCRIPTION_ACTION',
      id: 'e1f2g345-6789-0hij-klmn-opqrstuvwxyz',
    },
    'STRIPE_API_ERROR': {
      message: 'Error communicating with Stripe API',
      code: 'STRIPE_API_ERROR',
      id: 'f2g3h456-7890-1ijk-lmno-pqrstuvwxyz1',
    },
    'SCHOOL_ADMIN_REQUIRED': {
      message: 'School administrator access required',
      code: 'SCHOOL_ADMIN_REQUIRED',
      id: 'g3h4i567-8901-2jkl-mnop-qrstuvwxyz12',
    },
    'FREE_ACCESS_NO_PORTAL': {
      message: 'Billing portal not available for schools with complimentary access',
      code: 'FREE_ACCESS_NO_PORTAL',
      id: 'h4i5j678-9012-3klm-nopq-rstuvwxyz123',
    },
    'SCHOOL_NOT_FOUND': {
      message: 'School not found',
      code: 'SCHOOL_NOT_FOUND',
      id: 'i5j6k789-0123-4lmn-opqr-stuvwxyz1234',
    },
    'SUBSCRIPTION_INCOMPLETE': {
      message: 'Subscription is still being set up',
      code: 'SUBSCRIPTION_INCOMPLETE',
      id: 'j6k7l890-1234-5mno-pqrs-tuvwxyz12345',
    },
  },
};

export const paramDef = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['view', 'cancel', 'portal'], default: 'view' },
  },
} as const;

export default define(meta, paramDef, async (ps, user) => {
  // Check if user is school admin
  if (!user.isSchoolAdmin || !user.adminForSchoolId) {
    throw new ApiError(meta.errors.SCHOOL_ADMIN_REQUIRED);
  }

  const instance = await fetchMeta();
  if (!instance.stripeKey) {
    throw new ApiError(meta.errors.STRIPE_NOT_CONFIGURED);
  }

  const stripe = new Stripe(instance.stripeKey, {
    apiVersion: '2024-06-20',
  });

  // Get school billing information (most recent record)
  const billing = await SchoolBillings.findOne({
    where: { schoolId: user.adminForSchoolId },
    order: { createdAt: 'DESC' }, // CRITICAL: Get most recent billing record
  });
  if (!billing) {
    throw new ApiError(meta.errors.NO_ACTIVE_SUBSCRIPTION);
  }

  // Get school information to check for free access
  const school = await Schools.findOneBy({ id: user.adminForSchoolId });
  if (!school) {
    throw new ApiError({
      message: 'School not found',
      code: 'SCHOOL_NOT_FOUND',
      id: 'school-not-found-002',
      httpStatusCode: 404,
    });
  }

  // Check if school has free access (admin override) or was converted to free
  const hasFreeAccess = (school.metadata?.adminOverride || school.metadata?.freeActivation) && 
                       !school.metadata?.paidSubscriptionDespiteFree;
  
  // Also check if billing record shows free rate (converted from paid to free)
  const hasFreeBilling = billing.pricePerStudent === 0 && billing.metadata?.converted_to_free;

  // Handle free access schools (either never paid or converted to free)
  if (hasFreeAccess || hasFreeBilling) {
    // For free schools, provide a different response depending on the action
    if (ps.action === 'portal') {
      throw new ApiError({
        message: 'Your school has complimentary access to Campra. The billing portal is not available for schools with free access. Contact support if you need to upgrade to a paid plan.',
        code: 'FREE_ACCESS_NO_PORTAL',
        id: 'free-access-portal-001',
        httpStatusCode: 400,
      });
    }
    if (ps.action === 'view') {
      return {
        status: 'active',
        plan: 'Complimentary Access',
        current_period_end: null,
        amount: 0,
        trial_end: null,
        isFreeAccess: true,
      };
    }
    if (ps.action === 'cancel') {
      throw new ApiError({
        message: 'Your school has complimentary access. There is no subscription to cancel.',
        code: 'FREE_ACCESS_NO_SUBSCRIPTION',
        id: 'free-access-cancel-001',
        httpStatusCode: 400,
      });
    }
  }

  // If no Stripe customer ID and not free access, subscription setup is needed
  if (!billing.stripeCustomerId) {
    if (ps.action === 'portal' || ps.action === 'view') {
      throw new ApiError({
        message: 'Subscription not set up yet. Please activate your subscription first.',
        code: 'SUBSCRIPTION_NOT_SETUP',
        id: 'subscription-setup-001',
        httpStatusCode: 400,
      });
    }
    throw new ApiError(meta.errors.NO_ACTIVE_SUBSCRIPTION);
  }

  // Check if subscription is still being set up (incomplete status)
  if (billing.stripeSubscriptionId && billing.status === 'incomplete') {
    if (ps.action === 'portal') {
      throw new ApiError({
        message: 'Subscription is still being set up. Please wait a moment and try again.',
        code: 'SUBSCRIPTION_INCOMPLETE',
        id: 'subscription-incomplete-001',
        httpStatusCode: 400,
      });
    }
  }

  switch (ps.action) {
    case 'view':
      try {
        // Check for active subscriptions and prevent multiple subscriptions
        const subscriptions = await stripe.subscriptions.list({ 
          customer: billing.stripeCustomerId, 
          status: 'all', // Get all statuses to check for trialing and active
          limit: 10 // Get more than 1 to check for duplicates
        });
        
        // Filter for active or trialing subscriptions
        const activeSubscriptions = subscriptions.data.filter((sub: Stripe.Subscription) => 
          sub.status === 'active' || sub.status === 'trialing'
        );
        
        if (activeSubscriptions.length > 1) {
          logger.warn(`Multiple active/trialing subscriptions found for customer ${billing.stripeCustomerId}:`, 
            activeSubscriptions.map((s: Stripe.Subscription) => s.id));
          
          // Cancel extra subscriptions, keep the most recent one
          const sortedSubscriptions = activeSubscriptions.sort((a: Stripe.Subscription, b: Stripe.Subscription) => b.created - a.created);
          const keepSubscription = sortedSubscriptions[0];
          
          for (let i = 1; i < sortedSubscriptions.length; i++) {
            const extraSub = sortedSubscriptions[i];
            logger.info(`Cancelling duplicate subscription ${extraSub.id}`);
            await stripe.subscriptions.cancel(extraSub.id);
          }
          
          // Update our billing record to use the kept subscription
          await SchoolBillings.update(
            { schoolId: user!.adminForSchoolId },
            { stripeSubscriptionId: keepSubscription.id }
          );
          
          return {
            status: keepSubscription.status,
            plan: `School Subscription (${billing.studentCount} students)`,
            current_period_end: new Date(keepSubscription.current_period_end * 1000).toISOString(),
            amount: billing.totalAmount / 100, // Convert from cents to dollars
            trial_end: keepSubscription.trial_end ? new Date(keepSubscription.trial_end * 1000).toISOString() : null,
          };
        }
        
        if (activeSubscriptions.length > 0) {
          const subscription = activeSubscriptions[0];
          return {
            status: subscription.status,
            plan: `School Subscription (${billing.studentCount} students)`,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            amount: billing.totalAmount / 100, // Convert from cents to dollars
            trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
          };
        } else {
          throw new ApiError(meta.errors.NO_ACTIVE_SUBSCRIPTION);
        }
      } catch (error) {
        logger.error('Error retrieving Stripe subscription:', { error: String(error) });
        if (error instanceof Stripe.errors.StripeError) {
          throw new ApiError(meta.errors.STRIPE_API_ERROR);
        } else {
          throw error;
        }
      }

    case 'cancel':
      try {
        const subscriptions = await stripe.subscriptions.list({ 
          customer: billing.stripeCustomerId, 
          status: 'all', // Get all statuses including trialing
          limit: 10 // Get all active/trialing subscriptions
        });
        
        // Filter for active or trialing subscriptions to cancel
        const cancelableSubscriptions = subscriptions.data.filter((sub: Stripe.Subscription) => 
          sub.status === 'active' || sub.status === 'trialing'
        );
        
        if (cancelableSubscriptions.length > 0) {
          // Cancel all active and trialing subscriptions for this customer
          for (const subscription of cancelableSubscriptions) {
            await stripe.subscriptions.cancel(subscription.id);
            logger.info(`Cancelled subscription ${subscription.id} (status: ${subscription.status}) for school ${user!.adminForSchoolId}`);
          }
          
          // Update school status
          await Schools.update({ id: user!.adminForSchoolId }, { 
            subscriptionStatus: 'cancelled' 
          });
          
          // Update billing status
          await SchoolBillings.update(
            { schoolId: user!.adminForSchoolId },
            { status: 'cancelled' }
          );
          
          return { 
            message: `School subscription(s) cancelled successfully (${cancelableSubscriptions.length} subscription(s))` 
          };
        } else {
          throw new ApiError(meta.errors.NO_ACTIVE_SUBSCRIPTION);
        }
      } catch (error) {
        logger.error('Error cancelling subscription:', { error: String(error) });
        if (error instanceof Stripe.errors.StripeError) {
          throw new ApiError(meta.errors.STRIPE_API_ERROR);
        } else {
          throw error; // Re-throw if it's not a Stripe error
        }
      }

    case 'portal':
      try {
        const session = await stripe.billingPortal.sessions.create({
          customer: billing.stripeCustomerId,
          return_url: 'https://campra.app/school-admin/billing',
        });
        return { url: session.url };
      } catch (error) {
        logger.error('Error creating billing portal session:', { error: String(error) });
        if (error instanceof Stripe.errors.StripeError) {
          const stripeError = error as Stripe.errors.StripeError;
          
          // Check for specific portal configuration errors
          if (stripeError.message && (
            stripeError.message.includes('No configuration provided') ||
            stripeError.message.includes('Customer portal configuration') ||
            stripeError.message.includes('configuration is required')
          )) {
            throw new ApiError({
              message: 'Stripe Customer Portal is not properly configured. Please configure it in your Stripe dashboard at: https://dashboard.stripe.com/test/settings/billing/portal',
              code: 'STRIPE_PORTAL_NOT_CONFIGURED',
              id: 'stripe-portal-config-001',
              httpStatusCode: 400,
            });
          }
          
          // Log the specific Stripe error for debugging
          logger.error('Stripe API error details:', {
            type: stripeError.type,
            code: stripeError.code,
            message: stripeError.message,
            param: stripeError.param,
          });
          
          throw new ApiError({
            message: `Stripe API Error: ${stripeError.message}`,
            code: 'STRIPE_API_ERROR',
            id: 'stripe-api-error-001',
            httpStatusCode: 400,
          });
        } else {
          throw error; // Re-throw if it's not a Stripe error
        }
      }

    default:
      throw new ApiError(meta.errors.INVALID_SUBSCRIPTION_ACTION);
  }
});