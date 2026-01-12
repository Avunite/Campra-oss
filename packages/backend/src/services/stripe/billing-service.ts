import Stripe from 'stripe';
import { Schools, SchoolBillings, Users } from '@/models/index.js';
import { School } from '@/models/entities/school.js';
import { SchoolBilling } from '@/models/entities/school-billing.js';
import { genId } from '@/misc/gen-id.js';
import Logger from '@/services/logger.js';
import { BillingCalculation, getSchoolBillingRate } from './types.js';

const logger = new Logger('stripe-billing-service');

/**
 * Handles billing record management and calculations
 */
export class BillingService {
    constructor(private stripe: Stripe) {}

    /**
     * Get current student count for a school
     * Excludes staff, teachers, alumni, and billing-exempt users
     */
    async getSchoolStudentCount(schoolId: string): Promise<number> {
        return await Users.count({
            where: {
                schoolId: schoolId,
                enrollmentStatus: 'active',
                isAlumni: false,
                isSchoolAdmin: false,
                isTeacher: false,
                billingExempt: false,
            },
        });
    }

    /**
     * Calculate annual billing amount for a school
     */
    async calculateSchoolBilling(schoolId: string): Promise<BillingCalculation> {
        const school = await Schools.findOneBy({ id: schoolId });
        if (!school) {
            throw new Error(`School not found with ID: ${schoolId}`);
        }

        // All schools must have caps
        if (school.studentCap === null || !school.studentCapEnforced) {
            throw new Error(`School ${schoolId} does not have a student cap configured`);
        }

        const rate = await getSchoolBillingRate(school);
        const billingCount = school.studentCap; // Always use cap for billing
        const totalAmount = billingCount * rate;
        
        return {
            studentCount: billingCount,
            rate,
            totalAmount,
        };
    }

    /**
     * Get most recent billing record for a school
     */
    async getSchoolBilling(schoolId: string): Promise<SchoolBilling | null> {
        return await SchoolBillings.findOne({
            where: { schoolId },
            order: { createdAt: 'DESC' },
        });
    }

    /**
     * Create billing record for free school
     */
    async createFreeBillingRecord(
        school: School,
        transactionalEntityManager: any
    ): Promise<SchoolBilling> {
        const currentStudentCount = await this.getSchoolStudentCount(school.id);
        const now = new Date();
        const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        
        logger.info(`Creating free billing record for school ${school.id}`);
        
        const billing = transactionalEntityManager.create(SchoolBilling, {
            id: genId(),
            schoolId: school.id,
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            billingMode: 'prepaid_cap',
            billedStudentCap: school.studentCap,
            studentCount: currentStudentCount,
            pricePerStudent: 0,
            totalAmount: 0,
            billingCycle: 'annual',
            status: 'active',
            currentPeriodStart: now,
            currentPeriodEnd: oneYearFromNow,
            nextPaymentDate: null,
            lastPaymentDate: null,
            paymentMethod: null,
            metadata: {
                created_via: 'api',
                free_access: true,
                initial_student_count: currentStudentCount,
                admin_override: school.metadata?.adminOverride || false,
            },
        });
        
        await transactionalEntityManager.save(billing);
        logger.info(`✓ Created free billing record ${billing.id} for school ${school.id}`);
        
        return billing;
    }

    /**
     * Create billing record for paid subscription
     */
    async createPaidBillingRecord(
        school: School,
        customerId: string,
        subscription: Stripe.Subscription,
        rate: number,
        transactionalEntityManager: any
    ): Promise<SchoolBilling> {
        const currentStudentCount = await this.getSchoolStudentCount(school.id);
        const now = new Date();
        const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        
        logger.info(`Creating paid billing record for school ${school.id}`);
        logger.info(`  Customer ID: ${customerId}`);
        logger.info(`  Subscription ID: ${subscription.id}`);
        logger.info(`  Rate: $${rate}/student/year`);
        logger.info(`  Cap: ${school.studentCap} students`);
        
        const billing = transactionalEntityManager.create(SchoolBilling, {
            id: genId(),
            schoolId: school.id,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
            billingMode: 'prepaid_cap',
            billedStudentCap: school.studentCap,
            studentCount: currentStudentCount,
            pricePerStudent: rate,
            totalAmount: school.studentCap * rate,
            billingCycle: 'annual',
            status: subscription.status,
            currentPeriodStart: subscription.current_period_start 
                ? new Date(subscription.current_period_start * 1000) 
                : now,
            currentPeriodEnd: subscription.current_period_end 
                ? new Date(subscription.current_period_end * 1000) 
                : oneYearFromNow,
            nextPaymentDate: subscription.current_period_end 
                ? new Date(subscription.current_period_end * 1000) 
                : oneYearFromNow,
            lastPaymentDate: null,
            paymentMethod: null,
            metadata: {
                created_via: 'api',
                initial_student_count: currentStudentCount,
                initial_billing_quantity: school.studentCap,
            },
        });
        
        await transactionalEntityManager.save(billing);
        
        // CRITICAL: Verify the save worked
        logger.info(`✓ Saved billing record ${billing.id}`);
        logger.info(`  Verifying: stripeCustomerId = ${billing.stripeCustomerId}`);
        logger.info(`  Verifying: stripeSubscriptionId = ${billing.stripeSubscriptionId}`);
        
        if (!billing.stripeCustomerId || !billing.stripeSubscriptionId) {
            throw new Error(`CRITICAL: Billing record saved but Stripe IDs are null! Customer: ${billing.stripeCustomerId}, Subscription: ${billing.stripeSubscriptionId}`);
        }
        
        return billing;
    }

    /**
     * Update billing record with new subscription
     */
    async updateBillingWithSubscription(
        billingId: string,
        subscriptionId: string,
        status: string
    ): Promise<void> {
        logger.info(`Updating billing ${billingId} with subscription ${subscriptionId}`);
        
        await SchoolBillings.update(
            { id: billingId },
            { 
                stripeSubscriptionId: subscriptionId,
                status: status
            }
        );
        
        logger.info(`✓ Updated billing record`);
    }

    /**
     * Calculate prorated billing when rate changes mid-cycle
     */
    async calculateProratedBilling(
        subscriptionId: string, 
        newRate: number, 
        oldRate: number
    ): Promise<number> {
        const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
        
        const currentPeriodStart = new Date(subscription.current_period_start * 1000);
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
        const now = new Date();
        
        // Calculate days remaining in current period
        const totalDays = Math.ceil((currentPeriodEnd.getTime() - currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24));
        const remainingDays = Math.ceil((currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        // Calculate daily rates
        const dailyOldRate = oldRate / 365;
        const dailyNewRate = newRate / 365;
        
        // Calculate prorated amount per student for remaining period
        const prorationAmount = (dailyNewRate - dailyOldRate) * remainingDays;
        
        logger.info(`Proration calculation: ${remainingDays} days remaining at $${(dailyNewRate - dailyOldRate).toFixed(4)}/day = $${prorationAmount.toFixed(2)}/student`);
        
        return Math.round(prorationAmount * 100) / 100; // Round to 2 decimal places
    }
}
