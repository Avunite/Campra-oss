import define from '../../define.js';
import { Schools, Users } from '@/models/index.js';

export const meta = {
	tags: ['schools'],
	requireCredential: true,
	
	description: 'Get student cap status and utilization (school admin only)',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			studentCap: {
				type: 'number',
				optional: false,
				nullable: true,
			},
			currentStudentCount: {
				type: 'number',
				optional: false,
				nullable: false,
			},
			remainingCapacity: {
				type: 'number',
				optional: false,
				nullable: true,
			},
			utilizationPercentage: {
				type: 'number',
				optional: false,
				nullable: true,
			},
			capEnforced: {
				type: 'boolean',
				optional: false,
				nullable: false,
			},
			capStatus: {
				type: 'string',
				optional: false,
				nullable: false,
			},
			canRegisterNewStudents: {
				type: 'boolean',
				optional: false,
				nullable: false,
			},
			warningThreshold: {
				type: 'number',
				optional: false,
				nullable: true,
			},
			isNearCapacity: {
				type: 'boolean',
				optional: false,
				nullable: false,
			},
			lastCapUpdate: {
				type: 'string',
				optional: false,
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

	// Get school information
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

	// Calculate cap-related metrics
	const studentCap = school.studentCap;
	const capEnforced = school.studentCapEnforced;
	
	let remainingCapacity: number | null = null;
	let utilizationPercentage: number | null = null;
	let warningThreshold: number | null = null;
	let isNearCapacity = false;
	let capStatus = 'unlimited';
	let canRegisterNewStudents = true;

	if (studentCap !== null && capEnforced) {
		remainingCapacity = Math.max(0, studentCap - currentStudentCount);
		utilizationPercentage = Math.round((currentStudentCount / studentCap) * 100);
		warningThreshold = Math.floor(studentCap * 0.9); // 90% threshold
		isNearCapacity = currentStudentCount >= warningThreshold;
		canRegisterNewStudents = currentStudentCount < studentCap;

		if (currentStudentCount >= studentCap) {
			capStatus = 'at_capacity';
		} else if (isNearCapacity) {
			capStatus = 'near_capacity';
		} else if (utilizationPercentage >= 50) {
			capStatus = 'moderate_usage';
		} else {
			capStatus = 'low_usage';
		}
	} else if (studentCap !== null && !capEnforced) {
		capStatus = 'cap_disabled';
	}

	return {
		studentCap: studentCap,
		currentStudentCount: currentStudentCount,
		remainingCapacity: remainingCapacity,
		utilizationPercentage: utilizationPercentage,
		capEnforced: capEnforced,
		capStatus: capStatus,
		canRegisterNewStudents: canRegisterNewStudents,
		warningThreshold: warningThreshold,
		isNearCapacity: isNearCapacity,
		lastCapUpdate: school.studentCapSetAt?.toISOString() || null,
	};
});
