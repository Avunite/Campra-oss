import Stripe from 'stripe';
import { fetchMeta } from '@/misc/fetch-meta.js';
import Logger from '@/services/logger.js';

const logger = new Logger('stripe-pricing-service');

/**
 * Handles Stripe price creation and caching
 */
export class PricingService {
    private static priceCache = new Map<string, string>(); // rate -> priceId

    constructor(private stripe: Stripe) {}

    /**
     * Get or create Stripe price for a given rate
     * Uses caching to prevent duplicate prices
     */
    async getOrCreatePrice(rate: number): Promise<string> {
        // Validate rate is not zero
        if (rate === 0) {
            throw new Error('Cannot create Stripe price for $0 rate - free schools should not have Stripe subscriptions');
        }
        
        // Calculate price in cents
        const pricePerStudent = Math.round(rate * 100);
        
        // Additional safety check: ensure price is not zero after rounding
        if (pricePerStudent <= 0) {
            logger.error(`Attempted to create $0 Stripe price. Rate: ${rate}, Rounded: ${pricePerStudent} cents`);
            throw new Error(`Cannot create Stripe price for rate $${rate} - rounds to $0 (${pricePerStudent} cents). Minimum is $0.01`);
        }
        
        logger.info(`Getting Stripe price for rate: $${rate}/year (${pricePerStudent} cents)`);
        
        // Get the standard rate from Stripe configuration
        const meta = await fetchMeta();
        if (!meta.stripeSchoolPriceId) {
            throw new Error('Stripe school price ID not configured in admin settings');
        }
        
        // Fetch the actual standard rate from Stripe
        let standardRate = 15.00; // fallback
        try {
            const standardPrice = await this.stripe.prices.retrieve(meta.stripeSchoolPriceId);
            if (standardPrice.unit_amount) {
                standardRate = standardPrice.unit_amount / 100;
            }
        } catch (error) {
            logger.warn('Could not fetch standard rate from Stripe, using fallback', { error });
        }
        
        // For standard rate, use pre-configured price ID
        if (rate === standardRate) {
            logger.info(`Using standard price ID: ${meta.stripeSchoolPriceId}`);
            return meta.stripeSchoolPriceId;
        }

        // For custom rates, check cache first
        const rateKey = rate.toString();
        if (PricingService.priceCache.has(rateKey)) {
            const cachedPriceId = PricingService.priceCache.get(rateKey)!;
            
            // Verify the price still exists and its product is active
            try {
                const price = await this.stripe.prices.retrieve(cachedPriceId, {
                    expand: ['product'],
                });
                
                // Check if product is active
                const product = price.product as Stripe.Product;
                if (product && product.active) {
                    logger.info(`Using cached price ID: ${cachedPriceId} (product active)`);
                    return cachedPriceId;
                } else {
                    logger.warn(`Cached price ${cachedPriceId} has inactive product ${product?.id}, will search/create new one`);
                    PricingService.priceCache.delete(rateKey);
                }
            } catch (error) {
                // Price doesn't exist anymore, remove from cache
                logger.warn(`Cached price ${cachedPriceId} no longer exists, will search/create new one`);
                PricingService.priceCache.delete(rateKey);
            }
        }

        // Search for existing price with this exact amount before creating
        logger.info(`Searching for existing Stripe price with rate $${rate}/year (${pricePerStudent} cents)`);
        try {
            const existingPrices = await this.stripe.prices.list({
                active: true,
                currency: 'usd',
                type: 'recurring',
                limit: 100, // Get more prices to search through
                expand: ['data.product'], // Expand product to check if active
            });

            // Look for a price with matching amount, yearly interval, AND active product
            for (const price of existingPrices.data) {
                if (price.unit_amount === pricePerStudent && 
                    price.recurring?.interval === 'year') {
                    
                    // Check if product is active
                    const product = price.product as Stripe.Product;
                    if (product && product.active) {
                        logger.info(`✓ Found existing Stripe price ${price.id} for rate $${rate}/year with active product ${product.id}`);
                        // Cache the found price ID
                        PricingService.priceCache.set(rateKey, price.id);
                        return price.id;
                    } else {
                        logger.warn(`Found price ${price.id} but product ${product?.id} is inactive, skipping`);
                    }
                }
            }
            
            logger.info(`No existing active price found with rate $${rate}/year`);
        } catch (error) {
            logger.warn('Failed to search for existing prices, will create new one', { error });
        }

        // No existing price found, create new one
        logger.info(`Creating new Stripe price: $${rate}/year (${pricePerStudent} cents)`);
        
        // Create the product first
        const product = await this.stripe.products.create({
            name: `Campra Platform Access - $${rate}/student/year`,
            description: `Annual platform access at $${rate} per student per year`,
        });

        // Then create the price with the product ID
        const customPrice = await this.stripe.prices.create({
            currency: 'usd',
            unit_amount: pricePerStudent,
            recurring: {
                interval: 'year',
            },
            product: product.id,
            metadata: {
                rate_per_student: rate.toString(),
                billing_type: 'school_subscription',
            },
        });
        
        logger.info(`✓ Created Stripe price ${customPrice.id} for rate $${rate}/year`);

        // Cache the price ID
        PricingService.priceCache.set(rateKey, customPrice.id);
        
        return customPrice.id;
    }

    /**
     * Clear price cache (useful for testing)
     */
    static clearCache(): void {
        PricingService.priceCache.clear();
    }
}
