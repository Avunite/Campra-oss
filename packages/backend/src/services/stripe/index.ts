import Stripe from 'stripe';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { SubscriptionService } from './subscription-service.js';
import { CustomerService } from './customer-service.js';
import { PricingService } from './pricing-service.js';
import { BillingService } from './billing-service.js';
import { RateAndCapService } from './rate-and-cap-service.js';
import { SubscriptionCreationResult, BillingCalculation, getSchoolBillingRate, CapIncreaseResult } from './types.js';
import Logger from '@/services/logger.js';

const logger = new Logger('stripe-manager');

/**
 * Main Stripe Manager - orchestrates all Stripe operations
 * Replaces the monolithic StripeSchoolManager
 */
export class StripeManager {
    private stripe: Stripe;
    private subscriptionService: SubscriptionService;
    private customerServiceInstance: CustomerService;
    private pricingService: PricingService;
    private billingService: BillingService;
    private rateAndCapService: RateAndCapService;
    
    constructor(apiKey: string) {
        this.stripe = new Stripe(apiKey, {
            apiVersion: '2024-06-20',
        });
        
        // Initialize services
        this.subscriptionService = new SubscriptionService(this.stripe);
        this.customerServiceInstance = new CustomerService(this.stripe);
        this.pricingService = new PricingService(this.stripe);
        this.billingService = new BillingService(this.stripe);
        this.rateAndCapService = new RateAndCapService(this.stripe);
        
        logger.info('Stripe Manager initialized');
    }
    
    /**
     * Initialize Stripe instance from meta configuration
     */
    static async initialize(): Promise<StripeManager> {
        const meta = await fetchMeta();
        if (!meta.stripeKey) {
            throw new Error('Stripe API key not configured');
        }
        return new StripeManager(meta.stripeKey);
    }
    
    // ========================================
    // Subscription Operations
    // ========================================
    
    /**
     * Create school subscription
     */
    async createSchoolSubscription(
        schoolId: string,
        paymentMethodId?: string,
        forceUpgradeFromFree?: boolean
    ): Promise<SubscriptionCreationResult> {
        return await this.subscriptionService.createSchoolSubscription(
            schoolId,
            paymentMethodId,
            forceUpgradeFromFree
        );
    }
    
    /**
     * Update subscription when student count changes
     */
    async updateSchoolSubscription(schoolId: string): Promise<void> {
        return await this.subscriptionService.updateSchoolSubscription(schoolId);
    }
    
    // ========================================
    // Customer Operations
    // ========================================
    
    /**
     * Get existing Stripe customer ID for a school
     */
    async getSchoolStripeCustomerId(schoolId: string): Promise<string | null> {
        return await this.customerService.getSchoolStripeCustomerId(schoolId);
    }
    
    // ========================================
    // Billing Operations
    // ========================================
    
    /**
     * Calculate annual billing amount for a school
     */
    async calculateSchoolBilling(schoolId: string): Promise<BillingCalculation> {
        return await this.billingService.calculateSchoolBilling(schoolId);
    }
    
    /**
     * Get current student count for a school
     */
    async getSchoolStudentCount(schoolId: string): Promise<number> {
        return await this.billingService.getSchoolStudentCount(schoolId);
    }
    
    /**
     * Get school billing rate
     * Re-export from types for backwards compatibility
     */
    getSchoolBillingRate = getSchoolBillingRate;
    
    /**
     * Get most recent billing record
     */
    async getSchoolBilling(schoolId: string) {
        return await this.billingService.getSchoolBilling(schoolId);
    }
    
    // ========================================
    // Pricing Operations
    // ========================================
    
    /**
     * Get or create Stripe price for a given rate
     */
    async getOrCreateStripePrice(rate: number): Promise<string> {
        return await this.pricingService.getOrCreatePrice(rate);
    }
    
    // ========================================
    // Rate and Cap Operations
    // ========================================
    
    /**
     * Update subscription rate when billing rate changes
     */
    async updateSubscriptionRate(schoolId: string): Promise<void> {
        return await this.rateAndCapService.updateSubscriptionRate(schoolId);
    }
    
    /**
     * Update subscription to use cap-based billing
     */
    async updateSchoolSubscriptionToCap(schoolId: string, studentCap: number): Promise<void> {
        return await this.rateAndCapService.updateSchoolSubscriptionToCap(schoolId, studentCap);
    }
    
    /**
     * Create immediate charge for cap increase
     */
    async chargeForCapIncrease(
        schoolId: string,
        oldCap: number,
        newCap: number,
        rate: number
    ): Promise<CapIncreaseResult> {
        return await this.rateAndCapService.chargeForCapIncrease(schoolId, oldCap, newCap, rate);
    }
    
    // ========================================
    // Direct Stripe Access (for advanced operations)
    // ========================================
    
    /**
     * Get the customer service for advanced customer operations
     */
    get customerService(): CustomerService {
        return this.customerServiceInstance;
    }
    
    /**
     * Get the underlying Stripe instance for advanced operations
     * Use sparingly - prefer using the service methods
     */
    getStripeInstance(): Stripe {
        return this.stripe;
    }
}

// For backwards compatibility, also export as StripeSchoolManager
export { StripeManager as StripeSchoolManager };
