import { fetchMeta } from '@/misc/fetch-meta.js';
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
  },

  res: {
    type: 'object',
    optional: false, nullable: false,
    properties: {
      price_id_month: {
        type: 'object',
        optional: false, nullable: true,
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string' },
        },
      },
      price_id_year: {
        type: 'object',
        optional: false, nullable: true,
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string' },
        },
      },
      price_id_month_mp: {
        type: 'object',
        optional: false, nullable: true,
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string' },
        },
      },
      price_id_year_mp: {
        type: 'object',
        optional: false, nullable: true,
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string' },
        },
      },
      price_id_gift_month_plus: {
        type: 'object',
        optional: false, nullable: true,
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string' },
        },
      },
      price_id_gift_year_plus: {
        type: 'object',
        optional: false, nullable: true,
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string' },
        },
      },
      price_id_gift_month_mplus: {
        type: 'object',
        optional: false, nullable: true,
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string' },
        },
      },
      price_id_gift_year_mplus: {
        type: 'object',
        optional: false, nullable: true,
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string' },
        },
      },
    },
  },
};

export const paramDef = {
  type: 'object',
  properties: {},
  required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
  const instance = await fetchMeta();
  if (!instance.stripeKey) {
    throw new ApiError(meta.errors.STRIPE_NOT_CONFIGURED);
  }

  const stripe = new Stripe(instance.stripeKey, {
    apiVersion: '2024-06-20',
  });

  const prices = {};

  // Regular subscription prices
  if (instance.price_id_month) {
    try {
      const price = await stripe.prices.retrieve(instance.price_id_month);
      prices.price_id_month = {
        amount: price.unit_amount,
        currency: price.currency,
      };
    } catch (error) {
      console.error('Failed to fetch monthly plus price:', error);
    }
  }

  if (instance.price_id_year) {
    try {
      const price = await stripe.prices.retrieve(instance.price_id_year);
      prices.price_id_year = {
        amount: price.unit_amount,
        currency: price.currency,
      };
    } catch (error) {
      console.error('Failed to fetch yearly plus price:', error);
    }
  }

  if (instance.price_id_month_mp) {
    try {
      const price = await stripe.prices.retrieve(instance.price_id_month_mp);
      prices.price_id_month_mp = {
        amount: price.unit_amount,
        currency: price.currency,
      };
    } catch (error) {
      console.error('Failed to fetch monthly mini price:', error);
    }
  }

  if (instance.price_id_year_mp) {
    try {
      const price = await stripe.prices.retrieve(instance.price_id_year_mp);
      prices.price_id_year_mp = {
        amount: price.unit_amount,
        currency: price.currency,
      };
    } catch (error) {
      console.error('Failed to fetch yearly mini price:', error);
    }
  }

  // Gift subscription prices
  if (instance.price_id_gift_month_plus) {
    try {
      const price = await stripe.prices.retrieve(instance.price_id_gift_month_plus);
      prices.price_id_gift_month_plus = {
        amount: price.unit_amount,
        currency: price.currency,
      };
    } catch (error) {
      console.error('Failed to fetch monthly gift plus price:', error);
    }
  }

  if (instance.price_id_gift_year_plus) {
    try {
      const price = await stripe.prices.retrieve(instance.price_id_gift_year_plus);
      prices.price_id_gift_year_plus = {
        amount: price.unit_amount,
        currency: price.currency,
      };
    } catch (error) {
      console.error('Failed to fetch yearly gift plus price:', error);
    }
  }

  if (instance.price_id_gift_month_mplus) {
    try {
      const price = await stripe.prices.retrieve(instance.price_id_gift_month_mplus);
      prices.price_id_gift_month_mplus = {
        amount: price.unit_amount,
        currency: price.currency,
      };
    } catch (error) {
      console.error('Failed to fetch monthly gift mini price:', error);
    }
  }

  if (instance.price_id_gift_year_mplus) {
    try {
      const price = await stripe.prices.retrieve(instance.price_id_gift_year_mplus);
      prices.price_id_gift_year_mplus = {
        amount: price.unit_amount,
        currency: price.currency,
      };
    } catch (error) {
      console.error('Failed to fetch yearly gift mini price:', error);
    }
  }

  // If the prices aren't configured yet or couldn't be fetched, use placeholders
  if (!prices.price_id_gift_month_plus) {
    prices.price_id_gift_month_plus = { amount: 500, currency: 'usd' }; // $5
  }
  if (!prices.price_id_gift_year_plus) {
    prices.price_id_gift_year_plus = { amount: 5000, currency: 'usd' }; // $50
  }
  if (!prices.price_id_gift_month_mplus) {
    prices.price_id_gift_month_mplus = { amount: 300, currency: 'usd' }; // $3
  }
  if (!prices.price_id_gift_year_mplus) {
    prices.price_id_gift_year_mplus = { amount: 3000, currency: 'usd' }; // $30
  }

  return prices;
});
