import Stripe from 'stripe';
import { fetchMeta } from '@/misc/fetch-meta.js';
import Logger from '@/services/logger.js';

const logger = new Logger('stripe-price-fetcher');

export interface StripePriceInfo {
	pricePerStudentPerYear: number;
	currency: string;
	billingCycle: string;
}

/**
 * Service to fetch the current school subscription price from Stripe
 * This centralizes price fetching to avoid hardcoding prices throughout the codebase
 */
export class StripePriceFetcher {
	private static priceCache: StripePriceInfo | null = null;
	private static cacheTimestamp: number = 0;
	private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

	/**
	 * Get the current school subscription price from Stripe
	 * Returns cached value if available and recent, otherwise fetches from Stripe
	 */
	static async getPrice(): Promise<StripePriceInfo> {
		// Check if cache is still valid
		const now = Date.now();
		if (this.priceCache && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
			return this.priceCache;
		}

		const instance = await fetchMeta();
		
		// Default fallback values
		let priceInfo: StripePriceInfo = {
			pricePerStudentPerYear: 15.00,
			currency: 'USD',
			billingCycle: 'yearly',
		};
		
		// If Stripe is configured and we have a price ID, fetch the actual price
		if (instance.stripeKey && instance.stripeSchoolPriceId) {
			try {
				const stripe = new Stripe(instance.stripeKey, {
					apiVersion: '2024-11-20.acacia',
				});
				
				// Fetch price from Stripe
				const priceData = await stripe.prices.retrieve(instance.stripeSchoolPriceId);
				
				if (priceData.unit_amount && priceData.currency) {
					// Convert from cents to dollars
					priceInfo.pricePerStudentPerYear = priceData.unit_amount / 100;
					priceInfo.currency = priceData.currency.toUpperCase();
					
					// Get billing cycle from recurring info
					if (priceData.recurring?.interval) {
						priceInfo.billingCycle = priceData.recurring.interval === 'year' ? 'yearly' : 
						                         priceData.recurring.interval === 'month' ? 'monthly' : 
						                         priceData.recurring.interval;
					}
					
					logger.info(`Retrieved price from Stripe: $${priceInfo.pricePerStudentPerYear}/${priceInfo.billingCycle}`);
				}
			} catch (error) {
				logger.error('Failed to fetch price from Stripe, using default', { error });
				// Continue with defaults
			}
		} else {
			logger.warn('Stripe not configured, using default price');
		}

		// Update cache
		this.priceCache = priceInfo;
		this.cacheTimestamp = now;
		
		return priceInfo;
	}

	/**
	 * Clear the price cache (useful for testing or when price is updated)
	 */
	static clearCache(): void {
		this.priceCache = null;
		this.cacheTimestamp = 0;
		logger.info('Price cache cleared');
	}

	/**
	 * Get just the price amount (for backwards compatibility)
	 */
	static async getPriceAmount(): Promise<number> {
		const priceInfo = await this.getPrice();
		return priceInfo.pricePerStudentPerYear;
	}
}
