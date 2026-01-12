import define from '../../define.js';
import { Schools, SchoolBillings, Users } from '@/models/index.js';
import { StripeSchoolManager } from '@/services/stripe-school-manager.js';

export const meta = {
	tags: ['schools'],
	requireCredential: true,
	
	description: 'Request student cap increase (school admin only)',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			success: {
				type: 'boolean',
				optional: false,
				nullable: false,
			},
			message: {
				type: 'string',
				optional: false,
				nullable: false,
			},
			billing: {
				type: 'object',
				optional: true,
				nullable: true,
				properties: {
					clientSecret: { type: 'string', nullable: true },
					additionalCost: { type: 'number' },
					newTotalCost: { type: 'number' },
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		newCap: { 
			type: 'integer', 
			minimum: 1, 
			maximum: 50000,
		},
		reason: { type: 'string', maxLength: 500 },
	},
	required: ['newCap', 'reason'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Check if user is school admin
	if (!user.isSchoolAdmin || !user.adminForSchoolId) {
		throw new Error('Access denied: School admin access required');
	}

	const schoolId = user.adminForSchoolId;

	// Verify the school exists and has cap enforcement
	const school = await Schools.findOneBy({ id: schoolId });
	if (!school) {
		throw new Error('School not found');
	}

	if (!school.studentCapEnforced || school.studentCap === null) {
		throw new Error('School does not have student cap enforcement enabled');
	}

	// Validate new cap is higher than current cap
	if (ps.newCap <= school.studentCap) {
		throw new Error(`New cap (${ps.newCap}) must be higher than current cap (${school.studentCap})`);
	}

	// Get current student count (excluding teachers, admins, alumni)
	const currentStudentCount = await Users.count({
		where: {
			schoolId: schoolId,
			enrollmentStatus: 'active',
			isAlumni: false,
			isSchoolAdmin: false,
			isTeacher: false, // Exclude teachers
			billingExempt: false,
		},
	});

	// Find current billing record
	const billing = await SchoolBillings.findOne({
		where: { schoolId: schoolId },
		order: { createdAt: 'DESC' },
	});

	if (!billing) {
		throw new Error('No billing record found for school');
	}

	// Calculate additional cost for cap increase
	const stripeManager = await StripeSchoolManager.initialize();
	const rate = stripeManager.getSchoolBillingRate(school);
	const additionalStudents = ps.newCap - school.studentCap;
	const additionalCost = additionalStudents * rate;
	const newTotalCost = ps.newCap * rate;

	// Update school cap immediately
	await Schools.update({ id: schoolId }, {
		studentCap: ps.newCap,
		studentCapSetAt: new Date(),
		studentCapSetBy: user.id,
		metadata: {
			...school.metadata,
			studentCapHistory: [
				...(school.metadata?.studentCapHistory || []),
				{
					timestamp: new Date().toISOString(),
					adminId: user.id,
					adminUsername: user.username,
					previousCap: school.studentCap,
					newCap: ps.newCap,
					enforced: true,
					reason: ps.reason,
					currentStudentCount,
					type: 'school_admin_increase',
					additionalCost,
				},
			],
		},
	});

	// Handle billing for the cap increase
	let billingResponse = null;

	if (rate > 0 && additionalCost > 0) {
		// For paid schools, charge immediately for the additional capacity
		try {
			// Update billing record
			await SchoolBillings.update({ id: billing.id }, {
				billedStudentCap: ps.newCap,
				totalAmount: newTotalCost,
				metadata: {
					...billing.metadata,
					cap_increased_at: new Date().toISOString(),
					cap_increased_by: user.id,
					additional_students: additionalStudents,
					additional_cost: additionalCost,
					cap_increase_reason: ps.reason,
				},
			});

			// Create immediate charge for additional capacity
			if (billing.stripeCustomerId) {
				const chargeResult = await stripeManager.chargeForCapIncrease(
					schoolId, 
					school.studentCap, 
					ps.newCap, 
					rate
				);

				billingResponse = {
					clientSecret: chargeResult.clientSecret,
					additionalCost: additionalCost,
					newTotalCost: newTotalCost,
				};
			}
		} catch (error: any) {
			// If billing fails, revert the cap change
			await Schools.update({ id: schoolId }, {
				studentCap: school.studentCap,
				studentCapSetAt: school.studentCapSetAt,
				studentCapSetBy: school.studentCapSetBy,
			});
			
			throw new Error(`Failed to process payment for cap increase: ${error.message}`);
		}
	} else {
		// Free schools - just update the cap
		await SchoolBillings.update({ id: billing.id }, {
			billedStudentCap: ps.newCap,
			totalAmount: 0,
		});
	}

	return {
		success: true,
		message: rate > 0 
			? `Student cap increased to ${ps.newCap}. Additional charge of $${additionalCost.toFixed(2)} will be processed.`
			: `Student cap increased to ${ps.newCap}. No additional charge for free access.`,
		billing: billingResponse,
	};
});
