import Stripe from 'stripe';
import { SchoolBillings } from '@/models/index.js';
import { School } from '@/models/entities/school.js';
import Logger from '@/services/logger.js';

const logger = new Logger('stripe-customer-service');

/**
 * Handles Stripe customer creation and management
 */
export class CustomerService {
    constructor(private stripe: Stripe) {}

    /**
     * Get existing Stripe customer ID for a school
     */
    async getSchoolStripeCustomerId(schoolId: string): Promise<string | null> {
        const billing = await SchoolBillings.findOne({
            where: { schoolId },
            order: { createdAt: 'DESC' },
        });
        return billing?.stripeCustomerId || null;
    }

    /**
     * Generate customer email for a school
     */
    private generateCustomerEmail(school: School): string {
        if (school.domain && this.isValidDomain(school.domain)) {
            return `billing@${school.domain}`;
        } else {
            // Fallback: use school ID in a valid email format
            return `billing-${school.id}@campra.app`;
        }
    }

    /**
     * Create Stripe customer for a school
     */
    async createSchoolCustomer(school: School): Promise<string> {
        logger.info(`Creating Stripe customer for school: ${school.name} (${school.id})`);
        
        const customerEmail = this.generateCustomerEmail(school);
        
        const customer = await this.stripe.customers.create({
            name: school.name,
            email: customerEmail,
            metadata: {
                schoolId: school.id,
                schoolDomain: school.domain || 'unknown',
                type: 'school',
            },
        });
        
        logger.info(`✓ Created Stripe customer ${customer.id} for school ${school.id}`);
        return customer.id;
    }

    /**
     * Validate if a domain is properly formatted (has at least one dot)
     */
    private isValidDomain(domain: string): boolean {
        // Basic validation: domain should contain at least one dot and no spaces
        return domain.includes('.') && !domain.includes(' ') && domain.length > 3;
    }

    /**
     * Clean up duplicate customers for a school (admin utility)
     */
    async cleanupDuplicateCustomers(schoolId: string): Promise<{ deleted: string[], kept: string }> {
        const school = await SchoolBillings.findOne({
            where: { schoolId },
            order: { createdAt: 'DESC' },
        });
        
        if (!school) {
            throw new Error(`No billing record found for school ${schoolId}`);
        }
        
        // Find all customers with the same email
        const customerEmail = this.generateCustomerEmail(school as any);
        const customers = await this.stripe.customers.list({
            email: customerEmail,
        });
        
        if (customers.data.length <= 1) {
            return { deleted: [], kept: customers.data[0]?.id || '' };
        }
        
        // Keep the one with subscriptions, or the most recent one
        const customersWithSubs = customers.data.filter((c: Stripe.Customer) => c.subscriptions?.data.length > 0);
        let customerToKeep: Stripe.Customer;
        
        if (customersWithSubs.length > 0) {
            customerToKeep = customersWithSubs[0];
        } else {
            // Keep the most recent one
            customerToKeep = customers.data.sort((a: Stripe.Customer, b: Stripe.Customer) => 
                new Date(b.created).getTime() - new Date(a.created).getTime()
            )[0];
        }
        
        const deleted: string[] = [];
        
        for (const customer of customers.data) {
            if (customer.id !== customerToKeep.id) {
                await this.stripe.customers.del(customer.id);
                deleted.push(customer.id);
                logger.info(`Deleted duplicate customer ${customer.id} for school ${schoolId}`);
            }
        }
        
        return { deleted, kept: customerToKeep.id };
    }

    /**
     * Get or create customer for a school
     */
    async getOrCreateCustomer(school: School): Promise<string> {
        let customerId = await this.getSchoolStripeCustomerId(school.id);
        
        if (!customerId) {
            // Check if a customer already exists in Stripe with the same email
            const customerEmail = this.generateCustomerEmail(school);
            const existingCustomers = await this.stripe.customers.list({
                email: customerEmail,
                limit: 1,
            });
            
            if (existingCustomers.data.length > 0) {
                customerId = existingCustomers.data[0].id;
                logger.info(`Found existing Stripe customer ${customerId} for email ${customerEmail}, linking to school ${school.id}`);
                
                // Update the customer metadata to include school ID if not already present
                if (!existingCustomers.data[0].metadata.schoolId) {
                    await this.stripe.customers.update(customerId, {
                        metadata: {
                            ...existingCustomers.data[0].metadata,
                            schoolId: school.id,
                            schoolDomain: school.domain || 'unknown',
                            type: 'school',
                        },
                    });
                }
            } else {
                customerId = await this.createSchoolCustomer(school);
            }
        } else {
            logger.info(`Using existing Stripe customer ${customerId} for school ${school.id}`);
        }
        
        if (!customerId) {
            throw new Error(`Failed to get or create customer for school ${school.id}`);
        }
        
        return customerId;
    }
}
