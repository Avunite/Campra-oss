import Stripe from 'stripe';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { Users, Schools, SchoolBillings } from '@/models/index.js';
import Logger from '@/services/logger.js';
import define from '../../define.js';
import { ApiError } from '@/server/api/error.js';
import { subscriptionQueue } from '@/queue/queues.js';
import { genId } from '@/misc/gen-id.js';
import { StripeSchoolManager } from '@/services/stripe-school-manager.js';

const logger = new Logger('stripe-webhook');

// In-memory cache for webhook event idempotency
const processedWebhookEvents = new Set<string>();

export const meta = {
    tags: ['webhook'],
    requireCredential: false,
    secure: false,
} as const;

export const paramDef = {
    type: 'object',
    properties: {
        event: { type: 'object' },
        body: { type: 'string', nullable: true },
        signature: { type: 'string', nullable: true },
    },
    required: ['event'],
} as const;

export default define(meta, paramDef, async (ps) => {
    try {
        let event: Stripe.Event;
        
        // If we have raw body and signature, construct the event
        if (ps.body && ps.signature) {
            logger.info('Processing Stripe webhook with raw body and signature');
            const instance = await fetchMeta();
            if (!instance.stripeWebhookSecret) {
                logger.error('Stripe webhook secret is missing');
                throw new ApiError({
                    message: 'Stripe webhook is not configured properly',
                    code: 'STRIPE_WEBHOOK_MISCONFIGURED',
                    id: 'd5e6f7g8-h9i0-j1k2-l3m4-n5o6p7q8r9s0',
                    httpStatusCode: 500,
                });
            }
            
            const stripe = new Stripe(instance.stripeKey, {
                apiVersion: '2024-06-20',
            });
            
            try {
                event = stripe.webhooks.constructEvent(
                    ps.body,
                    ps.signature,
                    instance.stripeWebhookSecret
                );
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                logger.error(`Invalid Stripe webhook signature: ${errorMessage}`);
                throw new ApiError({
                    message: 'Invalid Stripe webhook signature',
                    code: 'INVALID_STRIPE_SIGNATURE',
                    id: 't1u2v3w4-x5y6-z7a8-b9c0-d1e2f3g4h5i6',
                    httpStatusCode: 400,
                });
            }
        } else {
            // Use the event object directly
            event = ps.event as Stripe.Event;
        }
        
        logger.info(`Processing verified Stripe event: ${event.type}`);

        const instance = await fetchMeta();
        if (!instance.stripeKey) {
            logger.error('Stripe API key is missing from meta configuration');
            throw new ApiError({
                message: 'Stripe API key is not configured properly',
                code: 'STRIPE_MISCONFIGURED',
                id: 'c02b9a7d-2a8b-4c24-b99c-f4e33ccb1292',
                httpStatusCode: 500,
            });
        }

        if (!instance.stripeWebhookSecret) {
            logger.error('Stripe webhook secret is missing from meta configuration');
            throw new ApiError({
                message: 'Stripe webhook secret is not configured properly',
                code: 'STRIPE_WEBHOOK_MISCONFIGURED',
                id: 'c02b9a7d-2a8b-4c24-b99c-f4e33ccb1293',
                httpStatusCode: 500,
            });
        }

        const stripe = new Stripe(instance.stripeKey, {
            apiVersion: '2024-06-20',
        });

        // Webhook event idempotency check using module-level cache
        const eventId = event.id;
        if (processedWebhookEvents.has(eventId)) {
            logger.info(`Webhook event ${eventId} already processed. Skipping.`);
            return { received: true, status: 'already_processed' };
        }
        
        // Mark event as processed (keep last 1000 events in memory)
        if (processedWebhookEvents.size > 1000) {
            const firstEvent = processedWebhookEvents.values().next().value;
            if (firstEvent) {
                processedWebhookEvents.delete(firstEvent);
            }
        }
        processedWebhookEvents.add(eventId);

        // Handle the event - SCHOOL-BASED SUBSCRIPTIONS
        switch (event.type) {
            case 'customer.subscription.created':
                await handleSchoolSubscriptionCreated(stripe, event.data.object as Stripe.Subscription);
                break;
            case 'checkout.session.completed':
                await handleSchoolCheckoutCompleted(stripe, event.data.object as Stripe.Checkout.Session);
                break;
            case 'invoice.payment_succeeded':
                await handleSchoolPaymentSucceeded(stripe, event.data.object as Stripe.Invoice);
                break;
            case 'invoice.payment_failed':
                await handleSchoolPaymentFailed(stripe, event.data.object as Stripe.Invoice);
                break;
            case 'customer.subscription.updated':
                await handleSchoolSubscriptionUpdated(stripe, event.data.object as Stripe.Subscription);
                break;
            case 'customer.subscription.deleted':
                await handleSchoolSubscriptionDeleted(stripe, event.data.object as Stripe.Subscription);
                break;
            default:
                logger.info(`Unhandled event type: ${event.type} - school subscription system active`);
        }

        logger.info('School subscription webhook processing completed successfully');
        return { received: true };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error processing school subscription webhook: ${errorMessage}`);
        if (error instanceof ApiError) {
            throw error;
        } else {
            throw new ApiError({
                message: 'Internal server error',
                code: 'INTERNAL_SERVER_ERROR',
                id: '5d3f2d7a-8c8f-4b9c-9b6a-9b6a9b6a9b6a',
                httpStatusCode: 500,
            });
        }
    }
});

async function handleSchoolSubscriptionCreated(stripe: Stripe, subscription: Stripe.Subscription) {
    const { customer } = subscription;
    logger.info(`Handling school subscription created for customer ${customer}`);

    try {
        const customerData = await stripe.customers.retrieve(customer as string);
        if ('deleted' in customerData) {
            logger.warn(`Customer ${customer} has been deleted`);
            return;
        }

        const schoolId = customerData.metadata.schoolId;
        if (!schoolId) {
            logger.warn(`No schoolId found in metadata for customer ${customer}`);
            return;
        }

        // Update school and billing record
        await Schools.update({ id: schoolId }, {
            subscriptionStatus: subscription.status === 'active' ? 'active' : 'pending',
        });

        // Update or create billing record
        const billing = await SchoolBillings.findOneBy({ schoolId });
        if (billing) {
            await SchoolBillings.update({ id: billing.id }, {
                stripeSubscriptionId: subscription.id,
                status: subscription.status,
                nextPaymentDate: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
            });
        }

        logger.info(`School subscription created successfully for school ${schoolId}`);
    } catch (error: any) {
        logger.error(`Error handling school subscription created event: ${error.message}`);
        throw new ApiError({
            message: 'Failed to process school subscription creation',
            code: 'SCHOOL_SUBSCRIPTION_CREATION_FAILED',
            id: '1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p',
            httpStatusCode: 500,
        });
    }
}

async function handleSchoolPaymentSucceeded(stripe: Stripe, invoice: Stripe.Invoice) {
    const { customer, subscription } = invoice;
    logger.info(`Handling school payment succeeded for customer ${customer}, subscription ${subscription}`);

    try {
        const customerData = await stripe.customers.retrieve(customer as string);
        if ('deleted' in customerData) {
            logger.warn(`Customer ${customer} has been deleted`);
            return;
        }

        const schoolId = customerData.metadata.schoolId;
        if (!schoolId) {
            logger.warn(`No schoolId found in metadata for customer ${customer}`);
            return;
        }

        // Handle subscription-based payments
        if (subscription) {
            // Update school status to active
            await Schools.update({ id: schoolId }, {
                subscriptionStatus: 'active',
            });

            // Update billing record with payment details
            await SchoolBillings.update(
                { schoolId: schoolId },
                { 
                    status: 'active',
                    lastPaymentDate: new Date(),
                    metadata: {
                        last_payment_success: new Date().toISOString(),
                        payment_retry_count: 0, // Reset retry count on success
                    }
                }
            );

            logger.info(`School subscription payment succeeded for school ${schoolId}`);
        } else {
            // Handle one-time payments (setup fees, etc.)
            logger.info(`One-time payment succeeded for school ${schoolId}, amount: ${invoice.amount_paid}`);
            
            // Still update the school to active if this is their first payment
            const school = await Schools.findOneBy({ id: schoolId });
            if (school && school.subscriptionStatus !== 'active') {
                await Schools.update({ id: schoolId }, {
                    subscriptionStatus: 'active',
                });
                logger.info(`School ${schoolId} activated via one-time payment`);
            }
        }
    } catch (error: any) {
        logger.error(`Error handling school payment succeeded event: ${error.message}`);
        // Don't throw error for payment success handling - just log
    }
}

async function handleSchoolPaymentFailed(stripe: Stripe, invoice: Stripe.Invoice) {
    const { customer, subscription } = invoice;
    logger.info(`Handling school payment failed for customer ${customer}, subscription ${subscription}`);

    try {
        const customerData = await stripe.customers.retrieve(customer as string);
        if ('deleted' in customerData) {
            logger.warn(`Customer ${customer} has been deleted`);
            return;
        }

        const schoolId = customerData.metadata.schoolId;
        if (!schoolId) {
            logger.warn(`No schoolId found in metadata for customer ${customer}`);
            return;
        }

        // Get current billing record to track failures
        const billing = await SchoolBillings.findOneBy({ schoolId });
        const currentRetryCount = billing?.metadata?.payment_retry_count || 0;
        const newRetryCount = currentRetryCount + 1;
        
        // IMMEDIATE SUSPENSION: Suspend access on ANY payment failure
        // This ensures no unauthorized access when payments fail
        
        // Update billing record to show payment failure
        await SchoolBillings.update(
            { schoolId: schoolId },
            { 
                status: 'suspended', // Immediately mark as suspended
                metadata: {
                    payment_retry_count: newRetryCount,
                    last_payment_failure: new Date().toISOString(),
                    immediate_suspension: true, // Flag for immediate suspension policy
                    suspension_reason: 'payment_failed'
                }
            }
        );

        // CRITICAL: Immediately suspend school access on payment failure
        await Schools.update({ id: schoolId }, {
            subscriptionStatus: 'suspended'
        });
        
        logger.warn(`Payment failed for school ${schoolId} - access suspended immediately (no grace period)`);
        
        // Call StripeSchoolManager to handle additional suspension logic
        try {
            const stripeManager = await StripeSchoolManager.initialize();
            await stripeManager.suspendSchoolAccess(schoolId, 'payment_failed');
            
            // Enhanced: Also suspend all active student sessions for immediate effect
            const { SchoolAccessManager } = await import('@/services/school-access-manager.js');
            await SchoolAccessManager.suspendAllSchoolSessions(schoolId);
            
        } catch (error: any) {
            logger.error(`Error calling StripeSchoolManager.suspendSchoolAccess: ${error.message}`);
        }
        
    } catch (error: any) {
        logger.error(`Error handling school payment failed event: ${error.message}`);
        // Don't throw error for payment failure handling - just log
    }
}

async function handleSchoolSubscriptionUpdated(stripe: Stripe, subscription: Stripe.Subscription) {
    const { customer } = subscription;
    logger.info(`Handling school subscription updated for customer ${customer}`);

    try {
        const customerData = await stripe.customers.retrieve(customer as string);
        if ('deleted' in customerData) {
            logger.warn(`Customer ${customer} has been deleted`);
            return;
        }

        const schoolId = customerData.metadata.schoolId;
        if (!schoolId) {
            logger.warn(`No schoolId found in metadata for customer ${customer}`);
            return;
        }

        // Update billing record with new subscription data
        await SchoolBillings.update(
            { schoolId: schoolId },
            { 
                status: subscription.status,
                nextPaymentDate: subscription.current_period_end 
                    ? new Date(subscription.current_period_end * 1000) 
                    : null,
            }
        );

        logger.info(`School subscription updated for school ${schoolId}: ${subscription.status}`);
    } catch (error: any) {
        logger.error(`Error handling school subscription updated event: ${error.message}`);
    }
}

async function handleSchoolSubscriptionDeleted(stripe: Stripe, subscription: Stripe.Subscription) {
    const { customer } = subscription;
    logger.info(`Handling school subscription deleted for customer ${customer}`);

    try {
        const customerData = await stripe.customers.retrieve(customer as string);
        if ('deleted' in customerData) {
            logger.warn(`Customer ${customer} has been deleted`);
            return;
        }

        const schoolId = customerData.metadata.schoolId;
        if (!schoolId) {
            logger.warn(`No schoolId found in metadata for customer ${customer}`);
            return;
        }

        // Update school status to suspended
        await Schools.update({ id: schoolId }, {
            subscriptionStatus: 'suspended',
        });

        // Update billing record
        await SchoolBillings.update(
            { schoolId: schoolId },
            { status: 'cancelled' }
        );

        // Enhanced: Also suspend all active student sessions
        try {
            const { SchoolAccessManager } = await import('@/services/school-access-manager.js');
            await SchoolAccessManager.suspendAllSchoolSessions(schoolId);
        } catch (error: any) {
            logger.error(`Error suspending school sessions: ${error.message}`);
        }

        logger.warn(`School subscription cancelled for school ${schoolId}`);
    } catch (error: any) {
        logger.error(`Error handling school subscription deleted event: ${error.message}`);
    }
}

async function handleSchoolCheckoutCompleted(stripe: Stripe, session: Stripe.Checkout.Session) {
    logger.info(`Handling school checkout.session.completed event, id: ${session.id}`);

    try {
        // Enhanced logging for debugging
        logger.info(`Session metadata: ${JSON.stringify(session.metadata || {})}`);
        logger.info(`Session mode: ${session.mode}, payment_status: ${session.payment_status}`);
        
        // Check if this is a school subscription purchase
        if (session.metadata && session.metadata.type === 'school_subscription' && session.mode === 'subscription' && session.payment_status === 'paid') {
            logger.info('Processing school subscription purchase from checkout.session.completed event');
            
            const schoolId = session.metadata.schoolId;
            if (!schoolId) {
                logger.error(`Missing schoolId in session metadata: ${JSON.stringify(session.metadata)}`);
                return;
            }

            // Update school subscription status
            await Schools.update({ id: schoolId }, {
                subscriptionStatus: 'active',
            });

            logger.info(`School subscription checkout completed for school ${schoolId}`);
        } else {
            logger.info('Checkout session was not a school subscription or was not completed successfully');
        }
    } catch (error: any) {
        logger.error(`Error handling school checkout.session.completed event: ${error.message}`);
        throw new ApiError({
            message: 'Failed to process school subscription purchase',
            code: 'SCHOOL_SUBSCRIPTION_PURCHASE_FAILED',
            id: 'e7f8g9h0-i1j2-k3l4-m5n6-o7p8q9r0s1t2',
            httpStatusCode: 500,
        });
    }
}