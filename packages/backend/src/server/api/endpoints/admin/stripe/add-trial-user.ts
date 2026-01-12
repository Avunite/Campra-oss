import { fetchMeta } from '@/misc/fetch-meta.js';
import { Users, UserProfiles } from '@/models/index.js';
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
    'EMAIL_REQUIRED': {
      message: 'Email is required for activating a trial subscription',
      code: 'EMAIL_REQUIRED',
      id: 'a3729a13-5dd1-4bfa-8e57-059c140d9c24',
    },
    'TRIAL_ACTIVATION_FAILED': {
      message: 'Failed to activate trial subscription',
      code: 'TRIAL_ACTIVATION_FAILED',
      id: 'r9s0t1u2-3v4w-5x6y-7z8a-9b0c1d2e3f4g',
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
      subscriptionId: {
        type: 'string',
        optional: false, nullable: false,
      },
    },
  },
};

export const paramDef = {
  type: 'object',
  properties: {
    userId: { type: 'string', format: 'campra:id' },
    trialDays: { type: 'integer', minimum: 1, maximum: 760, default: 14 },
  },
  required: ['userId'],
} as const;

export default define(meta, paramDef, async (ps, me) => {
  // Stripe integration disabled
  throw new ApiError({
    message: 'Stripe integration is disabled',
    code: 'STRIPE_DISABLED',
    id: 'stripe-disabled-003',
  });
  const instance = await fetchMeta();
  if (!instance.stripe_key || !instance.price_id_month) {
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

  // Fetch user's email from UserProfiles
  const userProfile = await UserProfiles.findOneBy({ userId: user.id });
  const userEmail = userProfile?.email;

  if (!userEmail) {
    throw new ApiError(meta.errors.EMAIL_REQUIRED);
  }

  try {
    let customerId: string;

    if (user.stripe_user) {
      // If the user has a stripe_user, attempt to retrieve the customer
      try {
        const customer = await stripe.customers.retrieve(user.stripe_user);
        customerId = customer.id;
      } catch (error) {
        console.warn(`Stripe customer not found for user ${user.id}, creating a new one.`);
        // If retrieval fails, create a new customer
        const newCustomer = await stripe.customers.create({
          email: userEmail,
          metadata: { userId: user.id, username: user.username },
        });
        customerId = newCustomer.id;
        await Users.update({ id: user.id }, { stripe_user: customerId });
      }
    } else {
      // If the user doesn't have a stripe_user, create a new customer
      const newCustomer = await stripe.customers.create({
        email: userEmail,
        metadata: { userId: user.id, username: user.username },
      });
      customerId = newCustomer.id;
      await Users.update({ id: user.id }, { stripe_user: customerId });
    }

    // Create a trial subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: instance.price_id_month }],
      trial_period_days: ps.trialDays || 14,
      metadata: { userId: user.id, username: user.username },
    });

    // Update user's isPlus status
    await Users.update({ id: user.id }, { isPlus: true });

    return {
      success: true,
      subscriptionId: subscription.id,
    };
  } catch (error) {
    console.error('Trial activation failed:', error);
    throw new ApiError(meta.errors.TRIAL_ACTIVATION_FAILED);
  }
});