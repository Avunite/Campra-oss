import Stripe from 'stripe';
import { Schools, SchoolBillings } from '@/models/index.js';
import { SchoolBilling } from '@/models/entities/school-billing.js';
import Logger from '@/services/logger.js';
import { getSchoolBillingRate } from './types.js';
import { PricingService } from './pricing-service.js';
import { BillingService } from './billing-service.js';

const logger = new Logger('stripe-rate-service');

/**
 * Handles subscription rate and cap updates
 * These operations modify existing Stripe subscriptions
 */
export class RateAndCapService {
    private pricingService: PricingService;
    private billingService: BillingService;

    constructor(private stripe: Stripe) {
        this.pricingService = new PricingService(stripe);
        this.billingService = new BillingService(stripe);
    }

    /**
     * Update subscription rate when billing rate changes
     */
    async updateSubscriptionRate(schoolId: string): Promise<void> {
        logger.info(`Updating subscription rate for school ${schoolId}`);
        
        const billing = await SchoolBillings.findOne({
            where: { schoolId },
            order: { createdAt: 'DESC' },
        });

        const school = await Schools.findOneBy({ id: schoolId });
        if (!school) {
            throw new Error('School not found');
        }

        const newRate = await getSchoolBillingRate(school);
        logger.info(`New rate: $${newRate}/student`);

        // Handle schools without Stripe subscriptions
        if (!billing?.stripeSubscriptionId) {
            if (newRate === 0) {
                logger.info(`School ${schoolId} is free - no Stripe subscription needed`);
                
                if (billing) {
                    await SchoolBillings.update({ id: billing.id }, {
                        pricePerStudent: 0,
                        totalAmount: 0,
                        metadata: {
                            ...billing.metadata,
                            rate_updated_at: new Date().toISOString(),
                            set_to_free_without_subscription: true,
                        },
                    });
                }
                return;
            }
            
            // School has rate but no subscription yet
            if (billing) {
                logger.info(`School ${schoolId} has rate $${newRate} but no Stripe subscription yet - updating billing record`);
                await SchoolBillings.update({ id: billing.id }, {
                    pricePerStudent: newRate,
                    totalAmount: (billing.studentCount || 0) * newRate,
                    metadata: {
                        ...billing.metadata,
                        rate_updated_at: new Date().toISOString(),
                        rate_set_before_subscription: true,
                    },
                });
            } else {
                logger.info(`School ${schoolId} has rate $${newRate} but no billing record - will be created with subscription`);
            }
            return;
        }

        // At this point, we have a valid Stripe subscription
        const oldRate = billing.pricePerStudent;
        
        // If converting to free, keep subscription but update billing
        if (newRate === 0) {
            logger.info(`School ${schoolId} is being set to free - keeping existing subscription but marking as free in billing`);
            
            await SchoolBillings.update({ id: billing.id }, {
                pricePerStudent: 0,
                totalAmount: 0,
                metadata: {
                    ...billing.metadata,
                    rate_updated_at: new Date().toISOString(),
                    previous_rate: oldRate,
                    converted_to_free: true,
                },
            });
            
            return;
        }
        
        // Calculate prorated amount for mid-cycle rate changes
        const prorationAmount = await this.billingService.calculateProratedBilling(
            billing.stripeSubscriptionId,
            newRate,
            oldRate
        );
        
        // If there's a significant proration, create immediate charge/credit
        if (Math.abs(prorationAmount) > 0.10) {
            const studentCount = billing.studentCount || 0;
            const totalProration = prorationAmount * studentCount;
            
            if (totalProration > 0) {
                // Rate increased - charge the difference
                await this.stripe.invoiceItems.create({
                    customer: billing.stripeCustomerId!,
                    amount: Math.round(totalProration * 100),
                    currency: 'usd',
                    description: `Prorated charge for rate change: $${oldRate} → $${newRate} per student`,
                    metadata: {
                        schoolId: schoolId,
                        studentCount: studentCount.toString(),
                        type: 'rate_change_proration',
                        old_rate: oldRate.toString(),
                        new_rate: newRate.toString(),
                    },
                });
                
                await this.stripe.invoices.create({
                    customer: billing.stripeCustomerId!,
                    auto_advance: true,
                    metadata: {
                        schoolId: schoolId,
                        type: 'rate_change_proration',
                    },
                });
                
                logger.info(`✓ Created prorated charge: $${totalProration.toFixed(2)} for rate change $${oldRate} → $${newRate}`);
            } else {
                // Rate decreased - create credit
                await this.stripe.invoiceItems.create({
                    customer: billing.stripeCustomerId!,
                    amount: Math.round(totalProration * 100), // Negative amount
                    currency: 'usd',
                    description: `Prorated credit for rate change: $${oldRate} → $${newRate} per student`,
                    metadata: {
                        schoolId: schoolId,
                        studentCount: studentCount.toString(),
                        type: 'rate_change_proration',
                    },
                });
                
                logger.info(`✓ Created prorated credit: $${Math.abs(totalProration).toFixed(2)} for rate change $${oldRate} → $${newRate}`);
            }
        }
        
        // Get or create new price
        const priceId = await this.pricingService.getOrCreatePrice(newRate);
        logger.info(`Using price ID: ${priceId}`);

        // Update subscription to use new price
        const subscription = await this.stripe.subscriptions.retrieve(billing.stripeSubscriptionId);
        
        // In cap-based billing, quantity should be the CAP, not current student count
        const billingQuantity = billing.billedStudentCap || school.studentCap || 1;
        const totalAmount = billingQuantity * newRate;
        
        logger.info(`Updating subscription: ${billingQuantity} students (cap) × $${newRate} = $${totalAmount.toFixed(2)}`);
        
        await this.stripe.subscriptions.update(billing.stripeSubscriptionId, {
            items: [{
                id: subscription.items.data[0].id,
                price: priceId,
                quantity: billingQuantity, // Use cap, not current student count!
            }],
            metadata: {
                ...subscription.metadata,
                rate_updated_at: new Date().toISOString(),
                new_rate: newRate.toString(),
                billing_quantity: billingQuantity.toString(),
            },
        });

        // Update billing record with new rate (use CAP for total amount)
        await SchoolBillings.update({ id: billing.id }, {
            pricePerStudent: newRate,
            totalAmount: totalAmount, // Cap × rate, not studentCount × rate!
            metadata: {
                ...billing.metadata,
                rate_updated_at: new Date().toISOString(),
                previous_rate: billing.pricePerStudent,
            },
        });

        logger.info(`✓ Updated subscription rate for school ${schoolId}: $${billing.pricePerStudent} → $${newRate} per student (${billingQuantity} cap × $${newRate} = $${totalAmount.toFixed(2)})`);
    }

    /**
     * Update subscription to use cap-based billing
     */
    async updateSchoolSubscriptionToCap(schoolId: string, studentCap: number): Promise<void> {
        logger.info(`Updating school ${schoolId} to cap-based billing with cap: ${studentCap}`);
        
        const billing = await SchoolBillings.findOne({
            where: { schoolId },
            order: { createdAt: 'DESC' },
        });

        if (!billing?.stripeSubscriptionId) {
            logger.warn(`No Stripe subscription found for school ${schoolId}`);
            return;
        }

        const school = await Schools.findOneBy({ id: schoolId });
        if (!school) {
            throw new Error('School not found');
        }

        const rate = await getSchoolBillingRate(school);

        // Free schools don't have Stripe subscriptions
        if (rate === 0) {
            logger.warn(`School ${schoolId} is free - cannot update Stripe subscription to cap billing`);
            return;
        }

        const newAmount = studentCap * rate;
        logger.info(`New billing amount: ${studentCap} × $${rate} = $${newAmount}`);

        // Get or create price
        const priceId = await this.pricingService.getOrCreatePrice(rate);

        // Update subscription to use cap quantity
        const subscription = await this.stripe.subscriptions.retrieve(billing.stripeSubscriptionId);
        
        await this.stripe.subscriptions.update(billing.stripeSubscriptionId, {
            items: [{
                id: subscription.items.data[0].id,
                price: priceId,
                quantity: studentCap, // Update quantity to match cap
            }],
            metadata: {
                ...subscription.metadata,
                billing_mode: 'prepaid_cap',
                student_cap: studentCap.toString(),
                rate_updated_at: new Date().toISOString(),
            },
        });

        // Update billing record
        await SchoolBillings.update({ id: billing.id }, {
            billingMode: 'prepaid_cap',
            billedStudentCap: studentCap,
            totalAmount: newAmount,
            metadata: {
                ...billing.metadata,
                billing_mode_changed_at: new Date().toISOString(),
                converted_to_cap_billing: true,
            },
        });

        logger.info(`✓ Updated school ${schoolId} to cap-based billing: ${studentCap} students at $${rate}/student = $${newAmount}/year`);
    }

    /**
     * Create immediate charge for cap increase
     */
    async chargeForCapIncrease(
        schoolId: string,
        oldCap: number,
        newCap: number,
        rate: number
    ): Promise<{ clientSecret: string | null }> {
        logger.info(`Charging for cap increase: ${oldCap} → ${newCap} at $${rate}/student`);
        
        const billing = await SchoolBillings.findOne({
            where: { schoolId },
            order: { createdAt: 'DESC' },
        });

        const additionalStudents = newCap - oldCap;
        const additionalCost = additionalStudents * rate;

        // No charge needed if cost is zero or negative
        if (additionalCost <= 0) {
            logger.info(`No charge needed: additional cost is $${additionalCost}`);
            return { clientSecret: null };
        }

        // If no Stripe customer yet, they'll be charged on activation
        if (!billing?.stripeCustomerId) {
            logger.info(`School ${schoolId} increased cap to ${newCap} but has no Stripe customer yet - will be charged on activation`);
            return { clientSecret: null };
        }

        logger.info(`Charging $${additionalCost} for ${additionalStudents} additional students`);

        // Create invoice item for the cap increase
        await this.stripe.invoiceItems.create({
            customer: billing.stripeCustomerId,
            amount: Math.round(additionalCost * 100),
            currency: 'usd',
            description: `Student cap increase: ${oldCap} → ${newCap} students (+${additionalStudents})`,
            metadata: {
                schoolId: schoolId,
                type: 'cap_increase',
                old_cap: oldCap.toString(),
                new_cap: newCap.toString(),
                additional_students: additionalStudents.toString(),
                rate_per_student: rate.toString(),
            },
        });

        // Create and finalize invoice for immediate payment
        const invoice = await this.stripe.invoices.create({
            customer: billing.stripeCustomerId,
            auto_advance: true,
            metadata: {
                schoolId: schoolId,
                type: 'cap_increase_charge',
            },
        });

        await this.stripe.invoices.finalizeInvoice(invoice.id);

        logger.info(`✓ Created cap increase charge of $${additionalCost} for school ${schoolId}`);

        return {
            clientSecret: invoice.payment_intent 
                ? (await this.stripe.paymentIntents.retrieve(invoice.payment_intent as string)).client_secret 
                : null,
        };
    }
}
