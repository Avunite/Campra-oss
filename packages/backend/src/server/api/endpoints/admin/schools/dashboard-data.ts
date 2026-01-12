import define from '../../../define.js';
import { Schools, SchoolBillings, Users } from '@/models/index.js';
import { StripePriceFetcher } from '@/services/stripe/price-fetcher.js';

export const meta = {
	tags: ['admin', 'schools'],
	requireCredential: true,
	requireAdmin: true,
	
	description: 'Get comprehensive dashboard data for school management',

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
					properties: {
						id: { type: 'string' },
						name: { type: 'string' },
						domain: { type: 'string' },
						location: { type: 'string', nullable: true },
						logoUrl: { type: 'string', nullable: true },
						studentCap: { type: 'number', nullable: true },
						studentCapEnforced: { type: 'boolean' },
						currentStudentCount: { type: 'number' },
						subscriptionStatus: { type: 'string' },
						billingRate: { type: 'number' },
						createdAt: { type: 'string' },
					},
				},
			},
			stats: {
				type: 'object',
				optional: false,
				nullable: false,
				properties: {
					totalSchools: { type: 'number' },
					schoolsWithCaps: { type: 'number' },
					totalStudents: { type: 'number' },
					totalCapacity: { type: 'number' },
					annualRevenue: { type: 'number' },
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
	let totalCapacity = 0;
	let annualRevenue = 0;
	let schoolsWithCaps = 0;

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
		if (school.metadata?.adminOverride || school.metadata?.freeActivation) {
			billingRate = 0;
		} else if (school.metadata?.customBillingRate) {
			billingRate = school.metadata.customBillingRate;
		} else if (school.metadata?.discountPercentage) {
			const discount = school.metadata.discountPercentage / 100;
			billingRate = standardRate * (1 - discount);
		}

		// Get latest billing record for subscription status
		const billing = await SchoolBillings.findOne({
			where: { schoolId: school.id },
			order: { createdAt: 'DESC' },
		});

		const subscriptionStatus = billing?.status || 'pending';

		const schoolData = {
			id: school.id,
			name: school.name,
			domain: school.domain,
			location: school.location,
			logoUrl: school.logoUrl,
			studentCap: school.studentCap,
			studentCapEnforced: school.studentCapEnforced,
			currentStudentCount,
			subscriptionStatus,
			billingRate,
			createdAt: school.createdAt.toISOString(),
		};

		schoolsData.push(schoolData);

		// Calculate totals
		totalStudents += currentStudentCount;
		
		if (school.studentCap) {
			schoolsWithCaps++;
			totalCapacity += school.studentCap;
			// For annual revenue, use cap if set, otherwise actual student count
			annualRevenue += school.studentCap * billingRate;
		} else {
			// If no cap, use current student count for revenue estimation
			annualRevenue += currentStudentCount * billingRate;
		}
	}

	const stats = {
		totalSchools: schools.length,
		schoolsWithCaps,
		totalStudents,
		totalCapacity,
		annualRevenue: Math.round(annualRevenue),
	};

	return {
		schools: schoolsData,
		stats,
	};
});
