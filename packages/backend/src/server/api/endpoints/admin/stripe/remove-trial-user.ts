import { fetchMeta } from '@/misc/fetch-meta.js';
import { Users } from '@/models/index.js';
import Stripe from 'stripe';
import define from '../../../define.js';
import { ApiError } from '../../../error.js';
import { HOUR } from '@/const.js';

export const meta = {
  tags: ['account', 'admin'],

  requireCredential: true,
  requireModerator: true,

  limit: {
    duration: HOUR,
    max: 30,
  },

  errors: {
    'STRIPE_NOT_CONFIGURED': {
      message: 'Stripe is not configured properly',
      code: 'STRIPE_NOT_CONFIGURED',
      id: 'c0c9f693-bed3-4543-88aa-5a87e7bee9c3',
    },
    'USER_NOT_FOUND': {
      message: 'User not found',
      code: 'USER_NOT_FOUND',
      id: '4362f8dc-731f-4ad8-a9c9-9a4eb5c8c216',
    },
    'STRIPE_CUSTOMER_NOT_FOUND': {
      message: 'Stripe customer not found for this user',
      code: 'STRIPE_CUSTOMER_NOT_FOUND',
      id: 'd4e5f6g7-8h9i-10j1-12k1-3l4m5n6o7p8q',
    },
    'NO_ACTIVE_SUBSCRIPTION': {
      message: 'No active subscription found for this user',
      code: 'NO_ACTIVE_SUBSCRIPTION',
      id: 'a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6',
    },
    'TRIAL_CANCELLATION_FAILED': {
      message: 'Failed to cancel trial subscription',
      code: 'TRIAL_CANCELLATION_FAILED',
      id: 'q7r8s9t0-u1v2-w3x4-y5z6-a7b8c9d0e1f2',
    },
  },

  res: {
    type: 'object',
    optional: false, nullable: false,
    properties: {
      success: {
        type: 'boolean',
        optional: false, nullable: false,
      },
    },
  },
};

export const paramDef = {
  type: 'object',
  properties: {
    userId: { type: 'string', format: 'campra:id' },
  },
  required: ['userId'],
} as const;

export default define(meta, paramDef, async (ps, me) => {
  // Stripe integration disabled
  throw new ApiError({
    message: 'Stripe integration is disabled',
    code: 'STRIPE_DISABLED',
    id: 'stripe-disabled-001',
  });
  const instance = await fetchMeta();
  if (!instance.stripe_key) {
    throw new ApiError(meta.errors.STRIPE_NOT_CONFIGURED);
  }

  const stripe = new Stripe(instance.stripe_key, {
    apiVersion: '2024-06-20',
  });

  // Find the user
  const user = await Users.findOneBy({ id: ps.userId });
  if (!user) {
    throw new ApiError(meta.errors.USER_NOT_FOUND);
  }

  if (!user.stripe_user) {
    throw new ApiError(meta.errors.STRIPE_CUSTOMER_NOT_FOUND);
  }

  try {
    // Retrieve the customer's subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripe_user,
      status: 'all',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      throw new ApiError(meta.errors.NO_ACTIVE_SUBSCRIPTION);
    }

    const subscription = subscriptions.data[0];

    // Cancel the subscription immediately
    await stripe.subscriptions.del(subscription.id);

    // Update user's isPlus status
    await Users.update({ id: user.id }, { isPlus: false });

    return {
      success: true,
    };
  } catch (error) {
    console.error('Trial cancellation failed:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(meta.errors.TRIAL_CANCELLATION_FAILED);
  }
});