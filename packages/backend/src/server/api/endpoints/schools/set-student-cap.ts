import define from '../../define.js';
import { Schools, SchoolBillings, Users } from '@/models/index.js';
import { StripeSchoolManager } from '@/services/stripe-school-manager.js';

export const meta = {
	tags: ['schools'],
	requireCredential: true,
	requireSchoolAdmin: true,
	
	description: 'Set student cap for own school (school admin only)',

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
			school: {
				type: 'object',
				optional: false,
				nullable: false,
				properties: {
					id: { type: 'string' },
					name: { type: 'string' },
					studentCap: { type: 'number' },
					studentCapEnforced: { type: 'boolean' },
					currentStudentCount: { type: 'number' },
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
	},
	required: ['studentCap'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Verify user is school admin
	if (!user.isSchoolAdmin || !user.adminForSchoolId) {
		throw new Error('School admin access required');
	}

	const schoolId = user.adminForSchoolId;

	// Verify the school exists
	const school = await Schools.findOneBy({ id: schoolId });
	if (!school) {
		throw new Error('School not found');
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

	// Validate cap is not lower than current student count
	if (ps.studentCap < currentStudentCount) {
		throw new Error(`Cannot set cap (${ps.studentCap}) below current student count (${currentStudentCount})`);
	}

	const previousCap = school.studentCap;

	// Update school with new cap settings
	await Schools.update({ id: schoolId }, {
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
					currentStudentCount,
				},
			],
		},
	});

	// Handle billing for cap changes
	try {
		const stripeManager = await StripeSchoolManager.initialize();
		const rate = await stripeManager.getSchoolBillingRate(school);

		// Find or create billing record
		let billing = await SchoolBillings.findOne({
			where: { schoolId: schoolId },
			order: { createdAt: 'DESC' },
		});

		const newAmount = ps.studentCap * rate;

		if (billing) {
			// Update existing billing record
			await SchoolBillings.update({ id: billing.id }, {
				billingMode: 'prepaid_cap',
				billedStudentCap: ps.studentCap,
				totalAmount: newAmount,
				metadata: {
					...billing.metadata,
					cap_changed_at: new Date().toISOString(),
					cap_changed_by: user.id,
					previous_cap: previousCap,
					new_cap: ps.studentCap,
					cap_increase_pending_charge: (!billing.stripeCustomerId && ps.studentCap > (previousCap || 0)) || undefined,
				},
			});

			// Update Stripe subscription if it exists
			// This will automatically handle proration for cap increases/decreases
			if (billing.stripeSubscriptionId) {
				try {
					await stripeManager.updateSchoolSubscriptionToCap(schoolId, ps.studentCap);
				} catch (updateError: any) {
					// Log but don't fail - billing record is updated
					// Could not update Stripe subscription
				}
			}
		} else {
			// Create new billing record
			const newBilling = SchoolBillings.create({
				schoolId: schoolId,
				billingMode: 'prepaid_cap',
				billedStudentCap: ps.studentCap,
				studentCount: currentStudentCount,
				pricePerStudent: rate,
				totalAmount: newAmount,
				billingCycle: 'annual',
				status: 'pending',
				metadata: {
					created_via: 'school_admin_cap_setup',
					cap_setup_by: user.id,
					no_stripe_customer_yet: true,
				},
			});
			await SchoolBillings.save(newBilling);
		}
	} catch (error: any) {
		// Log error but don't fail the cap setting
		// Failed to update billing for school
	}

	// Fetch updated school info
	const updatedSchool = await Schools.findOneByOrFail({ id: schoolId });

	return {
		success: true,
		message: `Student cap set to ${ps.studentCap} for ${school.name}. Billing will be processed accordingly.`,
		school: {
			id: updatedSchool.id,
			name: updatedSchool.name,
			studentCap: updatedSchool.studentCap,
			studentCapEnforced: updatedSchool.studentCapEnforced,
			currentStudentCount,
		},
	};
});
