import define from '../../../define.js';
import { Schools } from '@/models/index.js';
import { ApiError } from '../../../error.js';
import { SchoolAccessManager } from '@/services/school-access-manager.js';
import { StripeSchoolManager } from '@/services/stripe-school-manager.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
	
	description: 'Manually suspend or restore school access (administrative override)',

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
			affectedStudents: {
				type: 'number',
				optional: false,
				nullable: false,
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		schoolId: {
			type: 'string',
		},
		action: {
			type: 'string',
			enum: ['suspend', 'restore', 'unsuspend'], // Accept both 'restore' and 'unsuspend' for compatibility
		},
		reason: {
			type: 'string',
		},
	},
	required: ['schoolId', 'action', 'reason'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const school = await Schools.findOneBy({ id: ps.schoolId });
	if (!school) {
		throw new ApiError({
			message: 'School not found',
			code: 'SCHOOL_NOT_FOUND',
			id: 'school-not-found-001',
			httpStatusCode: 404,
		});
	}

	const stripeManager = await StripeSchoolManager.initialize();
	const suspensionInfo = await SchoolAccessManager.getSchoolSuspensionInfo(ps.schoolId);

	let message: string;
	let success = true;

	try {
		if (ps.action === 'suspend') {
			if (suspensionInfo.isSuspended) {
				message = `School "${school.name}" is already suspended`;
			} else {
				await stripeManager.suspendSchoolAccess(ps.schoolId, `admin_manual: ${ps.reason}`);
				await SchoolAccessManager.suspendAllSchoolSessions(ps.schoolId);
				message = `School "${school.name}" has been manually suspended by admin. Reason: ${ps.reason}`;
			}
		} else if (ps.action === 'restore' || ps.action === 'unsuspend') {
			if (!suspensionInfo.isSuspended) {
				message = `School "${school.name}" is not currently suspended`;
			} else {
				await stripeManager.restoreSchoolAccess(ps.schoolId);
				message = `School "${school.name}" access has been restored by admin. Reason: ${ps.reason}`;
			}
		}

		return {
			success,
			message,
			affectedStudents: suspensionInfo.affectedStudentCount,
		};
	} catch (error: any) {
		const actionText = ps.action === 'unsuspend' ? 'restore' : ps.action;
		throw new ApiError({
			message: `Failed to ${actionText} school access: ${error.message}`,
			code: 'SCHOOL_ACCESS_ACTION_FAILED',
			id: 'school-access-action-failed-001',
			httpStatusCode: 500,
		});
	}
});
