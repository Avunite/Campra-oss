import { fetchMeta } from '@/misc/fetch-meta.js';
import { Users, UserProfiles, GiftedSubscriptions } from '@/models/index.js';
import Stripe from 'stripe';
import define from '../../define.js';
import { ApiError } from '../../error.js';
import { HOUR } from '@/const.js';

export const meta = {
  tags: ['account'],

  requireCredential: true,

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
    'INVALID_SUBSCRIPTION_TYPE': {
      message: 'Invalid subscription type specified',
      code: 'INVALID_SUBSCRIPTION_TYPE',
      id: '8deb5f8f-c39d-4954-a373-a8df052b56e6',
    },
    'INVALID_STRIPE_SIGNATURE': {
      message: 'Invalid Stripe signature',
      code: 'INVALID_STRIPE_SIGNATURE',
      id: 'f5f3e871-6eb2-4b60-9891-c4b0c4dde544',
    },
    'EMAIL_REQUIRED': {
      message: 'Email is required for subscription',
      code: 'EMAIL_REQUIRED',
      id: 'a3729a13-5dd1-4bfa-8e57-059c140d9c24',
    },
    'INVALID_PLAN_OR_TYPE': {
      message: 'Invalid plan or subscription type specified for the operation.',
      code: 'INVALID_PLAN_OR_TYPE',
      id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef', // Example new ID
    },
  },

  res: {
    type: 'object',
    optional: false, nullable: false,
    properties: {
      url: {
        type: 'string',
        optional: false, nullable: false,
      },
    },
  },
};

export const paramDef = {
  type: 'object',
  properties: {
    subscriptionType: { type: 'string', enum: ['month', 'year'], nullable: true }, // Made nullable
    stripeSignature: { type: 'string', nullable: true },
    promoCode: { type: 'string', nullable: true },
    plan: { type: 'string', enum: ['plus', 'mplus'], nullable: true }, // Made nullable
    isGift: { type: 'boolean', nullable: true, default: false }, // Added isGift
    giftMessage: { type: 'string', nullable: true }, // Added giftMessage
  },
  // Removed required fields here, will validate in logic
} as const;

export default define(meta, paramDef, async (ps, user) => {
  // Stripe integration disabled
  throw new ApiError({
    message: 'Stripe integration is disabled',
    code: 'STRIPE_DISABLED',
    id: 'stripe-disabled-004',
  });
  
  // Check if user is demo - return mock response
  if (user.isDemo) {
    return {
      url: '/demo-checkout-success',
    };
  }
  
  const instance = await fetchMeta();
  if (!instance.stripeKey || !instance.stripeWebhookSecret) {
    throw new ApiError(meta.errors.STRIPE_NOT_CONFIGURED);
  }

  const stripe = new Stripe(instance.stripeKey, {
    apiVersion: '2024-06-20',
  });

  // This endpoint should only handle checkout session creation, not webhooks
  // All webhook handling is done in webhook.ts
  if (ps.stripeSignature) {
    throw new ApiError(meta.errors.INVALID_STRIPE_SIGNATURE, {
      message: 'Webhook handling should use webhook.ts endpoint'
    });
  }

  // Validate params for non-webhook calls
  if (ps.isGift) {
    if (!ps.plan || !ps.subscriptionType) {
      throw new ApiError(meta.errors.INVALID_PLAN_OR_TYPE, { message: 'Plan and subscriptionType are required for gift purchases.' });
    }
  } else {
    if (!ps.plan || !ps.subscriptionType) {
      throw new ApiError(meta.errors.INVALID_PLAN_OR_TYPE, { message: 'Plan and subscriptionType are required for regular subscriptions.' });
    }
  }

  // --- BEGIN ADDED DEBUG LOGGING ---
  console.log('[Checkout API Debug] Incoming params (ps):', JSON.stringify(ps));
  console.log('[Checkout API Debug] Instance object (price IDs relevant to gifts):');
  console.log('  instance.price_id_gift_month_mplus:', instance.price_id_gift_month_mplus);
  console.log('  instance.price_id_gift_month_plus:', instance.price_id_gift_month_plus);
  console.log('  instance.price_id_gift_year_mplus:', instance.price_id_gift_year_mplus);
  console.log('  instance.price_id_gift_year_plus:', instance.price_id_gift_year_plus);
  // --- END ADDED DEBUG LOGGING ---

  // Get appropriate price ID
  let priceId: string | undefined;

  if (ps.isGift) {
    if (ps.subscriptionType === 'month') {
      priceId = ps.plan === 'mplus' ? instance.price_id_gift_month_mplus : instance.price_id_gift_month_plus;
      
      // Check if gift prices are not configured, fall back to regular subscription prices
      if (!priceId) {
        console.warn('Gift price IDs not found in instance meta. Please configure gift price IDs as described in STRIPE_GIFT_SETUP.md');
        console.warn('Attempting to use regular subscription price IDs as fallback...');
        priceId = ps.plan === 'mplus' ? instance.price_id_month_mp : instance.price_id_month;
      }
    } else if (ps.subscriptionType === 'year') {
      priceId = ps.plan === 'mplus' ? instance.price_id_gift_year_mplus : instance.price_id_gift_year_plus;
      
      // Check if gift prices are not configured, fall back to regular subscription prices
      if (!priceId) {
        console.warn('Gift price IDs not found in instance meta. Please configure gift price IDs as described in STRIPE_GIFT_SETUP.md');
        console.warn('Attempting to use regular subscription price IDs as fallback...');
        priceId = ps.plan === 'mplus' ? instance.price_id_year_mp : instance.price_id_year;
      }
    }
  } else {
    if (ps.subscriptionType === 'month') {
      priceId = ps.plan === 'mplus' ? instance.price_id_month_mp : instance.price_id_month;
    } else if (ps.subscriptionType === 'year') {
      priceId = ps.plan === 'mplus' ? instance.price_id_year_mp : instance.price_id_year;
    }
  }

  if (!priceId) {
    console.error('No valid Stripe price ID found for subscription type:', ps.subscriptionType);
    throw new ApiError(meta.errors.INVALID_SUBSCRIPTION_TYPE);
  }

  // Fetch user's email from UserProfiles
  const userProfile = await UserProfiles.findOneBy({ userId: user.id });
  const userEmail = userProfile?.email;

  if (!userEmail) {
    throw new ApiError(meta.errors.EMAIL_REQUIRED);
  }

  // Check if the user has a stripe_user
  let customerId: string;
  if (user.stripe_user) {
    try {
      const existingCustomer = await stripe.customers.retrieve(user.stripe_user);
      customerId = existingCustomer.id;

      // Update the customer's email and metadata if necessary
      if (existingCustomer.email !== userEmail || 
          existingCustomer.metadata.userId !== user.id || 
          existingCustomer.metadata.planType !== ps.plan) {
        await stripe.customers.update(customerId, {
          email: userEmail,
          metadata: { 
            userId: user.id, 
            username: user.username,
            planType: ps.plan
          },
        });
      }
    } catch (error) {
      const newCustomer = await stripe.customers.create({
        email: userEmail,
        metadata: { 
          userId: user.id, 
          username: user.username,
          planType: ps.plan
        },
      });
      customerId = newCustomer.id;
      await Users.update({ id: user.id }, { stripe_user: customerId });
    }
  } else {
    const newCustomer = await stripe.customers.create({
      email: userEmail,
      metadata: { 
        userId: user.id, 
        username: user.username,
        planType: ps.plan
      },
    });
    customerId = newCustomer.id;
    await Users.update({ id: user.id }, { stripe_user: customerId });
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    allow_promotion_codes: true, // Keep for both, Stripe will ignore if not applicable for 'payment' mode
    customer: customerId, // For both, associates payment with customer
  };

  if (ps.isGift) {
    sessionParams.mode = 'payment';
    sessionParams.success_url = `${instance.url || 'https://campra.app'}/stripe/success?session_id={CHECKOUT_SESSION_ID}&plan=${ps.plan}`; // Pass plan in query for gift success
    sessionParams.cancel_url = `${instance.url || 'https://campra.app'}/stripe/cancelled?plan=${ps.plan}`; // Pass plan in query for gift cancel
    sessionParams.metadata = {
      isGift: 'true',
      plan: ps.plan!, // Already validated
      subscriptionType: ps.subscriptionType!, // Already validated
      purchaserUserId: user.id,
      giftMessage: ps.giftMessage || '',
    };
  } else {
    sessionParams.mode = 'subscription';
    sessionParams.success_url = `${instance.url || 'https://campra.app'}/stripe/success?plan=${ps.plan}`; // Use query param for consistency
    sessionParams.cancel_url = `${instance.url || 'https://campra.app'}/stripe/cancelled?plan=${ps.plan}`; // Use query param for consistency
    // Metadata for subscription customer is handled during customer creation/update
  }

  if (ps.promoCode) {
    sessionParams.discounts = [
      {
        promotion_code: ps.promoCode,
      },
    ];
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  return {
    url: session.url,
  };
});