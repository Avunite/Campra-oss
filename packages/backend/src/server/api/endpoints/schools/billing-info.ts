import define from '../../define.js';
import { Users, Schools, SchoolBillings } from '@/models/index.js';
import Logger from '@/services/logger.js';
import { StripePriceFetcher } from '@/services/stripe/price-fetcher.js';

export const meta = {
	tags: ['schools'],
	requireCredential: true,
	
	description: 'Get school billing information (school admin only)',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			id: {
				type: 'string',
				optional: false,
				nullable: false,
			},
			status: {
				type: 'string',
				optional: false,
				nullable: false,
			},
			studentCount: {
				type: 'number',
				optional: false,
				nullable: false,
				description: 'Current number of students enrolled',
			},
			studentCap: {
				type: 'number',
				optional: true,
				nullable: true,
				description: 'Student capacity limit (used for billing calculation)',
			},
			billedStudents: {
				type: 'number',
				optional: false,
				nullable: false,
				description: 'Number of students used for billing calculation (student cap or current count)',
			},
			pricePerStudentAnnual: {
				type: 'number',
				optional: false,
				nullable: false,
				description: 'Price per student per year ($15.00)',
			},
			totalAnnualAmount: {
				type: 'number',
				optional: false,
				nullable: false,
				description: 'Total annual billing amount (based on student cap if set, otherwise current student count)',
			},
			billingCycle: {
				type: 'string',
				optional: false,
				nullable: false,
				description: 'Always annual for school subscriptions',
			},
			nextPaymentDate: {
				type: 'string',
				optional: true,
				nullable: true,
			},
			lastPaymentDate: {
				type: 'string',
				optional: true,
				nullable: true,
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
	// Check if user is school admin
	if (!user.isSchoolAdmin || !user.adminForSchoolId) {
		throw new Error('Access denied: School admin access required');
	}

	const schoolId = user.adminForSchoolId;

	// Get school to check for custom billing rates
	const school = await Schools.findOneBy({ id: schoolId });
	if (!school) {
		throw new Error('School not found');
	}

	// Get standard rate from Stripe
	const standardRate = await StripePriceFetcher.getPriceAmount();
	
	// Calculate custom billing rate
	let pricePerStudent = standardRate;
	if (school.metadata?.customBillingRate) {
		pricePerStudent = school.metadata.customBillingRate;
	} else if (school.metadata?.discountPercentage) {
		const discount = school.metadata.discountPercentage / 100;
		pricePerStudent = standardRate * (1 - discount);
	}

	// Check for admin override (free) - but don't apply if school has chosen to pay
	const isFree = (school.metadata?.adminOverride || school.metadata?.freeActivation) && 
	               !school.metadata?.paidSubscriptionDespiteFree;
	if (isFree) {
		pricePerStudent = 0;
	}

	// Get current student count for display
	// Exclude school staff/admins, teachers, alumni, and platform staff from billing count
	const currentStudentCount = await Users.count({
		where: {
			schoolId: schoolId,
			enrollmentStatus: 'active',
			isAlumni: false,
			isSchoolAdmin: false, // Exclude school staff/admins from billing
			isTeacher: false, // Exclude teachers from billing
		},
	});

	// Determine billing count: Use student cap if set and enforced, otherwise current count
	let billedStudents = currentStudentCount;
	if (school.studentCapEnforced && school.studentCap !== null) {
		billedStudents = school.studentCap;
	}

	// Find the billing records for the school
	// Prioritize paid subscriptions over free ones
	const allBillings = await SchoolBillings.find({
		where: { schoolId: schoolId },
		order: { createdAt: 'DESC' },
	});
	
	// Find the most recent paid billing, or fall back to most recent billing
	const billing = allBillings.find((b: any) => b.stripeSubscriptionId) || allBillings[0];

	// If no billing exists, return default structure with current billing calculation
	if (!billing) {
		return {
			id: null,
			status: school.subscriptionStatus || 'pending',
			studentCount: currentStudentCount,
			studentCap: school.studentCap,
			billedStudents: billedStudents,
			pricePerStudentAnnual: pricePerStudent,
			totalAnnualAmount: billedStudents * pricePerStudent,
			billingCycle: 'annual',
			nextPaymentDate: null,
			lastPaymentDate: null,
		};
	}

	// Prioritize school's subscription status over billing status
	// This ensures manually suspended schools are shown as suspended
	const effectiveStatus = school.subscriptionStatus || billing.status;

	return {
		id: billing.id,
		status: effectiveStatus,
		studentCount: currentStudentCount, // Current enrolled students
		studentCap: school.studentCap, // Student capacity limit
		billedStudents: billedStudents, // Students used for billing calculation
		pricePerStudentAnnual: pricePerStudent, // Use custom rate if available
		totalAnnualAmount: billedStudents * pricePerStudent, // Calculate with billing count and custom rate
		billingCycle: billing.billingCycle,
		nextPaymentDate: billing.nextPaymentDate?.toISOString(),
		lastPaymentDate: billing.lastPaymentDate?.toISOString(),
	};
});
