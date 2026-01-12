import Stripe from 'stripe';
import { School } from '@/models/entities/school.js';
import { SchoolBilling } from '@/models/entities/school-billing.js';
import { StripePriceFetcher } from './price-fetcher.js';

/**
 * Shared types for Stripe services
 */

export interface BillingCalculation {
    studentCount: number;
    rate: number;
    totalAmount: number;
}

export interface SubscriptionCreationResult {
    subscription: Stripe.Subscription | null;
    billing: SchoolBilling;
}

export interface CapIncreaseResult {
    clientSecret: string | null;
}

/**
 * Get billing rate for a school based on metadata configuration
 * Now uses dynamic pricing from Stripe API
 */
export async function getSchoolBillingRate(school: School): Promise<number> {
    // Check if school has admin override for free access
    const isFree = (school.metadata?.adminOverride || school.metadata?.freeActivation) && 
                   !school.metadata?.paidSubscriptionDespiteFree;
    
    if (isFree) {
        return 0;
    }
    
    // Check for custom billing rate
    if (school.metadata?.customBillingRate) {
        return school.metadata.customBillingRate;
    }
    
    // Get the standard rate from Stripe
    const standardRate = await StripePriceFetcher.getPriceAmount();
    
    // Check for discount percentage
    if (school.metadata?.discountPercentage) {
        const discount = school.metadata.discountPercentage / 100;
        return Math.round((standardRate * (1 - discount)) * 100) / 100;
    }
    
    // Standard rate from Stripe
    return standardRate;
}
