import Stripe from 'stripe';
import { Schools } from '@/models/index.js';
import { School } from '@/models/entities/school.js';
import { db } from '@/db/postgre.js';
import Logger from '@/services/logger.js';
import { CustomerService } from './customer-service.js';
import { PricingService } from './pricing-service.js';
import { BillingService } from './billing-service.js';
import { SubscriptionCreationResult, getSchoolBillingRate } from './types.js';

const logger = new Logger('stripe-subscription-service');

/**
 * Handles Stripe subscription creation and management
 */
export class SubscriptionService {
    private customerService: CustomerService;
    private pricingService: PricingService;
    private billingService: BillingService;

    constructor(private stripe: Stripe) {
        this.customerService = new CustomerService(stripe);
        this.pricingService = new PricingService(stripe);
        this.billingService = new BillingService(stripe);
    }

    /**
     * Create school subscription with atomic transaction
     * This is the main entry point for subscription creation
     */
    async createSchoolSubscription(
        schoolId: string,
        paymentMethodId?: string,
        forceUpgradeFromFree: boolean = false
    ): Promise<SubscriptionCreationResult> {
        logger.info(`========================================`);
        logger.info(`Creating subscription for school ${schoolId}`);
        logger.info(`Payment method: ${paymentMethodId || 'none'}`);
        logger.info(`Force upgrade from free: ${forceUpgradeFromFree}`);
        logger.info(`========================================`);

        // Use database transaction to prevent race conditions
        return await db.transaction(async (transactionalEntityManager: any) => {
            const school = await transactionalEntityManager.findOneByOrFail(School, { id: schoolId });
            
            // Validate school has cap configured
            if (school.studentCap === null || !school.studentCapEnforced) {
                throw new Error(`Cannot create subscription: Student cap must be configured first`);
            }
            
            // Check for existing active billing
            const existingBilling = await this.billingService.getSchoolBilling(schoolId);
            if (existingBilling) {
                logger.info(`Found existing billing record: ${existingBilling.id}, status: ${existingBilling.status}`);
                
                // If already has active subscription, return it
                if (existingBilling.stripeSubscriptionId && 
                    ['active', 'incomplete', 'trialing'].includes(existingBilling.status)) {
                    logger.info(`School already has ${existingBilling.status} subscription ${existingBilling.stripeSubscriptionId}`);
                    const subscription = await this.stripe.subscriptions.retrieve(existingBilling.stripeSubscriptionId);
                    return { subscription, billing: existingBilling };
                }
            }
            
            // Get billing rate
            const rate = await getSchoolBillingRate(school);
            logger.info(`School billing rate: $${rate}/student/year`);
            
            // Handle free schools
            if (rate === 0 && !forceUpgradeFromFree) {
                // Check if they already have a paid subscription
                if (existingBilling?.stripeSubscriptionId) {
                    logger.info(`School has free rate but existing paid subscription - keeping paid`);
                    return { subscription: null, billing: existingBilling };
                }
                
                logger.info(`Creating free access billing record`);
                const billing = await this.billingService.createFreeBillingRecord(school, transactionalEntityManager);
                
                // Update school status
                await transactionalEntityManager.update(School, { id: schoolId }, { 
                    subscriptionStatus: 'active',
                });
                
                return { subscription: null, billing };
            }
            
            // Create paid subscription
            return await this.createPaidSubscription(
                school,
                rate,
                paymentMethodId,
                forceUpgradeFromFree,
                transactionalEntityManager
            );
        });
    }

    /**
     * Create a paid Stripe subscription
     */
    private async createPaidSubscription(
        school: School,
        rate: number,
        paymentMethodId: string | undefined,
        forceUpgradeFromFree: boolean,
        transactionalEntityManager: any
    ): Promise<SubscriptionCreationResult> {
        logger.info(`Creating paid subscription for school ${school.id}`);
        
        // Get or create Stripe customer
        const customerId = await this.customerService.getOrCreateCustomer(school);
        logger.info(`Using Stripe customer: ${customerId}`);
        
        // Get or create price
        const priceId = await this.pricingService.getOrCreatePrice(rate);
        logger.info(`Using Stripe price: ${priceId}`);
        
        // Get student count
        const currentStudentCount = await this.billingService.getSchoolStudentCount(school.id);
        logger.info(`Current student count: ${currentStudentCount}`);
        logger.info(`Student cap: ${school.studentCap}`);
        
        // Create subscription parameters
        const subscriptionParams: Stripe.SubscriptionCreateParams = {
            customer: customerId,
            items: [{
                price: priceId,
                quantity: Math.max(school.studentCap || 1, 1),
            }],
            metadata: {
                schoolId: school.id,
                studentCount: currentStudentCount.toString(),
                studentCap: (school.studentCap || 0).toString(),
                type: 'school_subscription',
            },
            expand: ['latest_invoice.payment_intent'],
            payment_behavior: 'default_incomplete',
            collection_method: 'charge_automatically',
        };

        // Add trial for zero-student schools
        if (currentStudentCount === 0) {
            subscriptionParams.trial_end = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
            subscriptionParams.metadata.trial_duration_days = '7';
            subscriptionParams.metadata.zero_student_trial = 'true';
            logger.info(`Setting 7-day trial for zero-student school`);
        }
        
        if (paymentMethodId) {
            subscriptionParams.default_payment_method = paymentMethodId;
            logger.info(`Using payment method: ${paymentMethodId}`);
        }
        
        // Create Stripe subscription
        logger.info(`Creating Stripe subscription...`);
        const subscription = await this.stripe.subscriptions.create(subscriptionParams);
        logger.info(`✓ Created Stripe subscription: ${subscription.id}`);
        logger.info(`  Status: ${subscription.status}`);
        logger.info(`  Customer: ${subscription.customer}`);
        
        // Create billing record
        const billing = await this.billingService.createPaidBillingRecord(
            school,
            customerId,
            subscription,
            rate,
            transactionalEntityManager
        );
        
        // Update school metadata
        if (forceUpgradeFromFree) {
            await transactionalEntityManager.update(School, { id: school.id }, {
                metadata: {
                    ...school.metadata,
                    paidSubscriptionDespiteFree: true,
                    paidSubscriptionCreatedAt: new Date().toISOString(),
                },
                subscriptionStatus: 'active',
            });
            logger.info(`✓ Marked school as upgraded from free`);
        } else {
            await transactionalEntityManager.update(School, { id: school.id }, { 
                subscriptionStatus: 'active',
            });
            logger.info(`✓ Updated school subscription status to active`);
        }
        
        logger.info(`========================================`);
        logger.info(`✓ SUBSCRIPTION CREATION COMPLETE`);
        logger.info(`  School: ${school.id}`);
        logger.info(`  Billing: ${billing.id}`);
        logger.info(`  Customer: ${billing.stripeCustomerId}`);
        logger.info(`  Subscription: ${billing.stripeSubscriptionId}`);
        logger.info(`========================================`);
        
        return { subscription, billing };
    }

    /**
     * Update subscription when student count changes
     */
    async updateSchoolSubscription(schoolId: string): Promise<void> {
        logger.info(`Updating subscription for school ${schoolId}`);
        
        const billing = await this.billingService.getSchoolBilling(schoolId);
        if (!billing || billing.status !== 'active') {
            logger.warn(`No active billing found for school ${schoolId}`);
            return;
        }
        
        const currentStudentCount = await this.billingService.getSchoolStudentCount(schoolId);
        
        if (currentStudentCount === billing.studentCount) {
            logger.info(`Student count unchanged: ${currentStudentCount}`);
            return;
        }
        
        // Handle free schools
        if (!billing.stripeSubscriptionId) {
            await SchoolBillings.update({ id: billing.id }, {
                studentCount: currentStudentCount,
                metadata: {
                    ...billing.metadata,
                    updated_at: new Date().toISOString(),
                    previous_student_count: billing.studentCount,
                },
            });
            logger.info(`Updated free school billing: ${billing.studentCount} → ${currentStudentCount} students`);
            return;
        }
        
        // For prepaid cap billing, just update metadata
        if (billing.billingMode === 'prepaid_cap') {
            const subscription = await this.stripe.subscriptions.retrieve(billing.stripeSubscriptionId);
            
            await this.stripe.subscriptions.update(billing.stripeSubscriptionId, {
                metadata: {
                    ...subscription.metadata,
                    actual_student_count: currentStudentCount.toString(),
                    updated_at: new Date().toISOString(),
                },
            });
            
            await SchoolBillings.update({ id: billing.id }, {
                studentCount: currentStudentCount,
            });
            
            logger.info(`✓ Updated prepaid cap billing: ${billing.studentCount} → ${currentStudentCount} students`);
        }
    }
}
