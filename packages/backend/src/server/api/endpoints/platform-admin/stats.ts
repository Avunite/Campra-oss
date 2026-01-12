import define from '../../define.js';
import { Users, Schools, SchoolBillings } from '@/models/index.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
	
	description: 'Get platform statistics for admin dashboard',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			totalSchools: {
				type: 'number',
				optional: false,
				nullable: false,
			},
			activeSchools: {
				type: 'number',
				optional: false,
				nullable: false,
			},
			totalStudents: {
				type: 'number',
				optional: false,
				nullable: false,
			},
			paidSchools: {
				type: 'number',
				optional: false,
				nullable: false,
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
	// Get total schools
	const totalSchools = await Schools.count();

	// Get active schools (those with active subscriptions)
	const activeSchools = await Schools.count({
		where: { subscriptionStatus: 'active' }
	});

	// Get total billable students (excluding school staff, teachers, and alumni)
	const totalStudents = await Users.count({
		where: {
			enrollmentStatus: 'active',
			isAlumni: false,
			isSchoolAdmin: false, // Exclude school staff from billing count
			isTeacher: false, // Exclude teachers from billing count
		},
	});

	// Get schools with paid subscriptions (excluding admin overrides)
	const billings = await SchoolBillings.find({
		where: { status: 'active' }
	});
	
	// Filter out free admin overrides
	const paidSchools = billings.filter(billing => 
		!billing.metadata || !billing.metadata.adminOverride
	).length;

	return {
		totalSchools,
		activeSchools,
		totalStudents,
		paidSchools,
	};
});
