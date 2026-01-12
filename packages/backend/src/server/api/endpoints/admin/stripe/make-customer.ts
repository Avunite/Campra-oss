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
      message: 'Email is required for creating a Stripe customer',
      code: 'EMAIL_REQUIRED',
      id: 'a3729a13-5dd1-4bfa-8e57-059c140d9c24',
    },
    'STRIPE_CUSTOMER_CREATION_FAILED': {
      message: 'Failed to create Stripe customer',
      code: 'STRIPE_CUSTOMER_CREATION_FAILED',
      id: 'b23a5d8f-8f12-4e3b-9f7a-8c9b6c1a9e5d',
    },
  },

  res: {
    type: 'object',
    optional: false, nullable: false,
    properties: {
      id: {
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
  },
  required: ['userId'],
} as const;

export default define(meta, paramDef, async (ps, me) => {
  // Stripe integration disabled
  throw new ApiError({
    message: 'Stripe integration is disabled',
    code: 'STRIPE_DISABLED',
    id: 'stripe-disabled-002',
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

  // Fetch user's email from UserProfiles
  const userProfile = await UserProfiles.findOneBy({ userId: user.id });
  const userEmail = userProfile?.email;

  if (!userEmail) {
    throw new ApiError(meta.errors.EMAIL_REQUIRED);
  }

  try {
    // Create a new Stripe Customer for the user
    const newCustomer = await stripe.customers.create({
      email: userEmail,
      metadata: { userId: user.id, username: user.username },
    });

    // Update the user's record with the new Stripe customer ID
    await Users.update({ id: user.id }, { stripe_user: newCustomer.id });

    return {
      id: newCustomer.id,
    };
  } catch (error) {
    console.error('Stripe customer creation failed:', error);
    throw new ApiError(meta.errors.STRIPE_CUSTOMER_CREATION_FAILED);
  }
});