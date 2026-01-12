import define from '../../../define.js';
import { Schools, SchoolBillings, Users } from '@/models/index.js';
import { StripeSchoolManager } from '@/services/stripe-school-manager.js';

export const meta = {
	tags: ['admin', 'schools'],
	requireCredential: true,
	requireAdmin: true,
	
	description: 'Set student cap for a school (platform admin only)',

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
		schoolId: { type: 'string', format: 'campra:id' },
		studentCap: { 
			type: 'integer', 
			minimum: 1, 
			maximum: 50000,
		},
	},
	required: ['schoolId', 'studentCap'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Verify the school exists
	const school = await Schools.findOneBy({ id: ps.schoolId });
	if (!school) {
		throw new Error('School not found');
	}

	// Get current student count (excluding teachers, admins, alumni)
	const currentStudentCount = await Users.count({
		where: {
			schoolId: ps.schoolId,
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

	// Update school with new cap settings - caps are always enforced in prepaid system
	await Schools.update({ id: ps.schoolId }, {
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
					previousCap: school.studentCap,
					newCap: ps.studentCap,
					enforced: true, // Always enforced
					currentStudentCount,
				},
			],
		},
	});

	// Set up prepaid cap billing - this is the only billing mode now
	try {
		// Find or create billing record
		let billing = await SchoolBillings.findOne({
			where: { schoolId: ps.schoolId },
			order: { createdAt: 'DESC' },
		});

		const stripeManager = await StripeSchoolManager.initialize();
		const rate = await stripeManager.getSchoolBillingRate(school);
		const newAmount = ps.studentCap * rate;

		if (billing) {
			// Update existing billing to prepaid cap mode
			await SchoolBillings.update({ id: billing.id }, {
				billingMode: 'prepaid_cap',
				billedStudentCap: ps.studentCap,
				totalAmount: newAmount,
				metadata: {
					...billing.metadata,
					billing_mode_changed_at: new Date().toISOString(),
					billing_mode_changed_by: user.id,
					previous_billing_mode: billing.billingMode || 'per_student',
				},
			});

			// If there's an active Stripe subscription, update it to reflect the new cap-based billing
			if (billing.stripeSubscriptionId) {
				await stripeManager.updateSchoolSubscriptionToCap(ps.schoolId, ps.studentCap);
			}
		} else {
			// Create new billing record for new school
			const newBilling = SchoolBillings.create({
				schoolId: ps.schoolId,
				billingMode: 'prepaid_cap',
				billedStudentCap: ps.studentCap,
				studentCount: currentStudentCount,
				pricePerStudent: rate,
				totalAmount: newAmount,
				billingCycle: 'annual',
				status: 'pending', // Will be activated when payment is processed
				metadata: {
					created_via: 'admin_cap_setup',
					billing_mode_changed_by: user.id,
				},
			});
			await SchoolBillings.save(newBilling);
		}
	} catch (error: any) {
		// Log error but don't fail the cap setting
		// Using basic logging since console might not be available
		throw new Error(`Failed to update billing for school ${ps.schoolId}: ${error.message}`);
	}

	// Fetch updated school info
	const updatedSchool = await Schools.findOneByOrFail({ id: ps.schoolId });

	return {
		success: true,
		message: `Student cap set to ${ps.studentCap} for ${school.name}. Prepaid billing activated for ${ps.studentCap} students.`,
		school: {
			id: updatedSchool.id,
			name: updatedSchool.name,
			studentCap: updatedSchool.studentCap,
			studentCapEnforced: updatedSchool.studentCapEnforced,
			currentStudentCount,
		},
	};
});
