import define from '../../define.js';
import { Schools, Users, SchoolBillings } from '@/models/index.js';
import { StripePriceFetcher } from '@/services/stripe/price-fetcher.js';
import { SchoolService } from '@/services/school-service.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
	
	description: 'List all schools with statistics (platform admin only)',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			schools: {
				type: 'array',
				optional: false,
				nullable: false,
				items: {
					type: 'object',
					optional: false,
					nullable: false,
					properties: {
						id: { type: 'string', format: 'campra:id' },
						name: { type: 'string' },
						domain: { type: 'string' },
						type: { type: 'string' },
						location: { type: 'string', nullable: true },
						description: { type: 'string', nullable: true },
						logoUrl: { type: 'string', nullable: true },
						websiteUrl: { type: 'string', nullable: true },
						isActive: { type: 'boolean' },
						studentCount: { type: 'number' },
						billingRate: { type: 'number' },
						billingType: { type: 'string' },
						customRate: { type: 'number', nullable: true },
						discountPercentage: { type: 'number', nullable: true },
						annualRevenue: { type: 'number' },
						subscriptionStatus: { type: 'string' },
						hasActiveSubscription: { type: 'boolean' },
						metadata: { type: 'object', nullable: true },
						createdAt: { type: 'string' },
						updatedAt: { type: 'string' },
					},
				},
			},
			stats: {
				type: 'object',
				optional: false,
				nullable: false,
				properties: {
					totalSchools: { type: 'number' },
					activeSchools: { type: 'number' },
					totalStudents: { type: 'number' },
					monthlyRevenue: { type: 'number' },
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Get all schools with related data
	const schools = await Schools.find({
		order: { createdAt: 'DESC' },
	});

	const schoolsData = [];
	let totalStudents = 0;
	let totalRevenue = 0;
	let activeSchools = 0;

	for (const school of schools) {
		// Get current student count for this school (excluding teachers, admins, alumni)
		const currentStudentCount = await Users.count({
			where: {
				schoolId: school.id,
				enrollmentStatus: 'active',
				isAlumni: false,
				isSchoolAdmin: false,
				isTeacher: false, // Exclude teachers
				billingExempt: false,
			},
		});

		// Get standard rate from Stripe
		const standardRate = await StripePriceFetcher.getPriceAmount();
		
		// Get billing rate
		let billingRate = standardRate;
		let billingType = 'standard';
		let customRate = null;
		let discountPercentage = null;

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

		// Get latest billing record for subscription status
		const billing = await SchoolBillings.findOne({
			where: { schoolId: school.id },
			order: { createdAt: 'DESC' },
		});

		// Prioritize school's subscription status over billing status
		// This ensures suspended schools show as suspended even if billing is active
		const subscriptionStatus = school.subscriptionStatus || billing?.status || 'pending';
		const hasActiveSubscription = await SchoolService.hasActiveSubscription(school.id);

		// Calculate annual revenue
		const annualRevenue = currentStudentCount * billingRate;

		const schoolData = {
			id: school.id,
			name: school.name,
			domain: school.domain,
			type: school.type,
			location: school.location,
			description: school.description,
			logoUrl: school.logoUrl,
			websiteUrl: school.websiteUrl,
			isActive: school.isActive,
			studentCount: currentStudentCount,
			billingRate,
			billingType,
			customRate,
			discountPercentage,
			annualRevenue,
			subscriptionStatus,
			hasActiveSubscription,
			metadata: school.metadata,
			createdAt: school.createdAt.toISOString(),
			updatedAt: school.updatedAt.toISOString(),
		};

		schoolsData.push(schoolData);

		// Calculate totals
		totalStudents += currentStudentCount;
		totalRevenue += annualRevenue;
		
		if (school.isActive && hasActiveSubscription) {
			activeSchools++;
		}
	}

	const stats = {
		totalSchools: schools.length,
		activeSchools,
		totalStudents,
		monthlyRevenue: Math.round(totalRevenue / 12), // Convert annual to monthly
	};

	return {
		schools: schoolsData,
		stats,
	};
});
