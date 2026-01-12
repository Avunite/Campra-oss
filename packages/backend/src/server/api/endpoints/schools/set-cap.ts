import define from '../../define.js';
import { Schools, SchoolBillings, Users } from '@/models/index.js';
import { StripeSchoolManager } from '@/services/stripe-school-manager.js';

export const meta = {
	tags: ['schools'],
	requireCredential: true,
	
	description: 'Set student cap for your school (school admin only)',

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
		studentCap: { 
			type: 'integer', 
			minimum: 1, 
			maximum: 50000,
		},
		reason: { type: 'string', maxLength: 500 },
	},
	required: ['studentCap', 'reason'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Check if user is a school admin
	if (!user.isSchoolAdmin || !user.adminForSchoolId) {
		throw new Error('School administrator access required');
	}

	// Verify the school exists and user has access to it
	const school = await Schools.findOneBy({ id: user.adminForSchoolId });
	if (!school) {
		throw new Error('School not found');
	}

	// Get current student count (excluding teachers, admins, alumni)
	const currentStudentCount = await Users.count({
		where: {
			schoolId: user.adminForSchoolId,
			enrollmentStatus: 'active',
			isAlumni: false,
			isSchoolAdmin: false,
			isTeacher: false, // Exclude teachers
			billingExempt: false,
		},
	});

	// Validate cap is not lower than current student count
	if (ps.studentCap < currentStudentCount) {
		throw new Error(`Cannot set cap (${ps.studentCap}) below current student count (${currentStudentCount})`);
	}

	const previousCap = school.studentCap;
	const isIncrease = !previousCap || ps.studentCap > previousCap;

	// Update school with new cap settings
	await Schools.update({ id: user.adminForSchoolId }, {
		studentCap: ps.studentCap,
		studentCapEnforced: true, // Always enforced in prepaid cap system
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
					previousCap: previousCap,
					newCap: ps.studentCap,
					enforced: true,
					reason: ps.reason,
					currentStudentCount,
					setBySchoolAdmin: true,
				},
			],
		},
	});

	let billingInfo = null;

	// Handle billing for cap increases
	if (isIncrease) {
		try {
			const stripeManager = await StripeSchoolManager.initialize();
			const rate = stripeManager.getSchoolBillingRate(school);
			
			// Calculate additional cost
			const previousCapForBilling = previousCap || 0;
			const additionalStudents = ps.studentCap - previousCapForBilling;
			const additionalCost = additionalStudents * rate;
			const newTotalCost = ps.studentCap * rate;

			if (additionalCost > 0) {
				// Create or update billing record
				let billing = await SchoolBillings.findOne({
					where: { schoolId: user.adminForSchoolId },
					order: { createdAt: 'DESC' },
				});

				if (billing) {
					// Update existing billing
					await SchoolBillings.update({ id: billing.id }, {
						billingMode: 'prepaid_cap',
						billedStudentCap: ps.studentCap,
						totalAmount: newTotalCost,
						metadata: {
							...billing.metadata,
							cap_updated_at: new Date().toISOString(),
							cap_updated_by: user.id,
							previous_cap: previousCap,
							cap_update_reason: ps.reason,
						},
					});
				} else {
					// Create new billing record
					const newBilling = SchoolBillings.create({
						schoolId: user.adminForSchoolId,
						billingMode: 'prepaid_cap',
						billedStudentCap: ps.studentCap,
						studentCount: currentStudentCount,
						pricePerStudent: rate,
						totalAmount: newTotalCost,
						billingCycle: 'annual',
						status: 'pending',
						metadata: {
							created_via: 'school_admin_cap_setup',
							cap_billing_reason: ps.reason,
							created_by_school_admin: user.id,
						},
					});
					await SchoolBillings.save(newBilling);
				}

				// For cap increases that require payment, charge immediately
				if (billing?.stripeSubscriptionId && additionalCost > 0) {
					const result = await stripeManager.chargeForCapIncrease(
						user.adminForSchoolId,
						previousCapForBilling,
						ps.studentCap,
						rate
					);

					billingInfo = {
						clientSecret: result.clientSecret,
						additionalCost,
						newTotalCost,
					};
				}
			}

		} catch (error: any) {
			// If billing fails, revert the cap change
			await Schools.update({ id: user.adminForSchoolId }, {
				studentCap: previousCap,
				studentCapEnforced: school.studentCapEnforced,
			});
			
			throw new Error(`Failed to process billing for cap increase: ${error.message}`);
		}
	}

	const message = billingInfo
		? `Student cap increased to ${ps.studentCap}. Additional payment of $${billingInfo.additionalCost.toFixed(2)} will be processed.`
		: `Student cap set to ${ps.studentCap} successfully.`;

	return {
		success: true,
		message,
		billing: billingInfo,
	};
});
