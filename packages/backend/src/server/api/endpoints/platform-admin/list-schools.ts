import define from '../../define.js';
import { Schools, SchoolBillings, DriveFiles } from '@/models/index.js';
import { SchoolService } from '@/services/school-service.js';
import { StripeSchoolManager } from '@/services/stripe-school-manager.js';
import { StripePriceFetcher } from '@/services/stripe/price-fetcher.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
	
	description: 'List all schools on the platform',

	res: {
		type: 'array',
		optional: false,
		nullable: false,
		items: {
			type: 'object',
			optional: false,
			nullable: false,
			properties: {
				id: {
					type: 'string',
					optional: false,
					nullable: false,
					format: 'campra:id',
				},
				name: {
					type: 'string',
					optional: false,
					nullable: false,
				},
				domain: {
					type: 'string',
					optional: false,
					nullable: false,
				},
				type: {
					type: 'string',
					optional: false,
					nullable: false,
				},
				isDemo: {
					type: 'boolean',
					optional: false,
					nullable: false,
				},
				studentCount: {
					type: 'number',
					optional: false,
					nullable: false,
				},
				billingRate: {
					type: 'number',
					optional: false,
					nullable: false,
					description: 'Effective billing rate per student per year',
				},
				billingType: {
					type: 'string',
					optional: false,
					nullable: false,
					description: 'Type of billing: standard, custom, discount, or free',
				},
				customRate: {
					type: 'number',
					optional: true,
					nullable: true,
					description: 'Custom rate if applicable',
				},
				discountPercentage: {
					type: 'number',
					optional: true,
					nullable: true,
					description: 'Discount percentage if applicable',
				},
				annualRevenue: {
					type: 'number',
					optional: false,
					nullable: false,
					description: 'Annual revenue from this school',
				},
				subscriptionStatus: {
					type: 'string',
					optional: false,
					nullable: false,
				},
				metadata: {
					type: 'object',
					optional: true,
					nullable: true,
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
		offset: { type: 'integer', minimum: 0, default: 0 },
		search: { type: 'string', maxLength: 256 },
		type: { 
			type: 'string', 
			enum: ['university', 'college', 'k12', 'trade_school', 'private_school']
		},
		subscriptionStatus: {
			type: 'string',
			enum: ['active', 'pending', 'suspended', 'cancelled']
		},
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const query = Schools.createQueryBuilder('school')
		.leftJoinAndSelect('school.billing', 'billing')
		.orderBy('school.createdAt', 'DESC');

	// Apply filters
	if (ps.search) {
		query.andWhere('(school.name ILIKE :search OR school.domain ILIKE :search)', {
			search: `%${ps.search}%`,
		});
	}

	if (ps.type) {
		query.andWhere('school.type = :type', { type: ps.type });
	}

	// Apply pagination
	query.skip(ps.offset).take(ps.limit);

	const schools = await query.getMany();

	// Get billing information and student counts for each school
	const schoolsWithData = await Promise.all(
		schools.map(async (school: any) => {
			const studentCount = await SchoolService.getStudentCount(school.id);
			const hasActiveSubscription = await SchoolService.hasActiveSubscription(school.id);
			
			// Get latest billing record
			const billing = await SchoolBillings.findOne({
				where: { schoolId: school.id },
				order: { createdAt: 'DESC' },
			});

			// Get standard rate from Stripe
			const standardRate = await StripePriceFetcher.getPriceAmount();
			
			// Calculate billing rate information using StripeSchoolManager
			let billingRate = standardRate;
			let billingType = 'standard';
			let customRate = null;
			let discountPercentage = null;
			
			try {
				const stripeManager = await StripeSchoolManager.initialize();
				billingRate = await stripeManager.getSchoolBillingRate(school);
				
				// Determine billing type based on metadata
				if (school.metadata?.adminOverride || school.metadata?.freeActivation) {
					billingType = 'free';
				} else if (school.metadata?.customBillingRate) {
					billingType = 'custom';
					customRate = school.metadata.customBillingRate;
				} else if (school.metadata?.discountPercentage) {
					billingType = 'discount';
					discountPercentage = school.metadata.discountPercentage;
				}
			} catch (error) {
				// If StripeSchoolManager fails to initialize, use fallback logic
				if (school.metadata?.adminOverride || school.metadata?.freeActivation) {
					billingRate = 0;
					billingType = 'free';
				} else if (school.metadata?.customBillingRate) {
					billingRate = school.metadata.customBillingRate;
					billingType = 'custom';
					customRate = school.metadata.customBillingRate;
				} else if (school.metadata?.discountPercentage) {
					const discount = school.metadata.discountPercentage / 100;
					billingRate = standardRate * (1 - discount);
					billingType = 'discount';
					discountPercentage = school.metadata.discountPercentage;
				}
			}

			// Calculate annual revenue
			const annualRevenue = studentCount * billingRate;

			// Determine subscription status - use the most current information
			// Priority: school.subscriptionStatus (updated by Stripe webhooks) > billing.status > 'pending'
			let subscriptionStatus = school.subscriptionStatus || billing?.status || 'pending';
			
			// If the school has active billing but status shows pending, update it to active
			if (billing?.status === 'active' && subscriptionStatus === 'pending') {
				subscriptionStatus = 'active';
			}

			// Resolve logo URL from logoId if present
			let logoUrl = school.logoUrl;
			if (school.logoId && !logoUrl) {
				try {
					const logoFile = await DriveFiles.findOneBy({ id: school.logoId });
					if (logoFile) {
						logoUrl = await DriveFiles.getSecureUrl(logoFile, false) || logoFile.url;
					}
				} catch (error) {
					// If drive file doesn't exist or can't be accessed, logoUrl will remain null
				}
			}

			return {
				id: school.id,
				name: school.name,
				domain: school.domain,
				type: school.type,
				location: school.location,
				description: school.description,
				logoUrl: logoUrl,
				websiteUrl: school.websiteUrl,
				isActive: school.isActive,
				isDemo: school.isDemo,
				studentCount,
				studentCap: school.studentCap,
				studentCapEnforced: school.studentCapEnforced,
				billingRate,
				billingType,
				customRate,
				discountPercentage,
				annualRevenue,
				subscriptionStatus,
				hasActiveSubscription,
				metadata: school.metadata,
				createdAt: school.createdAt,
				updatedAt: school.updatedAt,
			};
		})
	);

	// Apply subscription status filter if specified
	if (ps.subscriptionStatus) {
		return schoolsWithData.filter((school: any) => school.subscriptionStatus === ps.subscriptionStatus);
	}

	return schoolsWithData;
});
