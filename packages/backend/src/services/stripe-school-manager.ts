/**
 * DEPRECATED: This file is kept for backwards compatibility only
 * All new code should import from '@/services/stripe'
 * 
 * The monolithic StripeSchoolManager has been refactored into modular services:
 * - SubscriptionService: Handles subscription creation and management
 * - CustomerService: Handles Stripe customer operations
 * - PricingService: Handles price creation and caching
 * - BillingService: Handles billing calculations and records
 * - StripeManager: Main orchestrator that ties everything together
 */

export { StripeManager as StripeSchoolManager } from './stripe/index.js';
export { getSchoolBillingRate } from './stripe/types.js';
export type { BillingCalculation, SubscriptionCreationResult } from './stripe/types.js';
