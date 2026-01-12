import define from '../../define.js';
import { Schools } from '@/models/index.js';

export const meta = {
	tags: ['schools'],
	requireCredential: true,
	
	description: 'Get school settings (school admin only)',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			registrationSettings: {
				type: 'object',
				optional: false,
				nullable: false,
				properties: {
					allowDomainSignups: {
						type: 'boolean',
						optional: false,
						nullable: false,
					},
					requireInvitation: {
						type: 'boolean',
						optional: false,
						nullable: false,
					},
					autoGraduationEnabled: {
						type: 'boolean',
						optional: false,
						nullable: false,
					},
					allowStudentsChooseUsername: {
						type: 'boolean',
						optional: false,
						nullable: false,
					},
				},
			},
			location: {
				type: 'string',
				optional: true,
				nullable: true,
			},
			coordinates: {
				type: 'object',
				optional: true,
				nullable: true,
				properties: {
					latitude: {
						type: 'number',
						optional: false,
						nullable: false,
					},
					longitude: {
						type: 'number',
						optional: false,
						nullable: false,
					},
				},
			},
		},
	},

	errors: {
		accessDenied: {
			message: 'Access denied: School admin access required',
			code: 'ACCESS_DENIED',
			id: 'school-admin-012',
		},
		schoolNotFound: {
			message: 'School not found',
			code: 'SCHOOL_NOT_FOUND',
			id: 'school-admin-013',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		schoolId: { type: 'string', format: 'campra:id' },
	},
	required: ['schoolId'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Check if user is school admin for this school
	if (!user.isSchoolAdmin || user.adminForSchoolId !== ps.schoolId) {
		throw new Error('ACCESS_DENIED');
	}

	// Find the school
	const school = await Schools.findOneBy({ id: ps.schoolId });
	if (!school) {
		throw new Error('SCHOOL_NOT_FOUND');
	}

	// Format coordinates for response
	let coordinates = null;
	if (school.coordinates) {
		coordinates = {
			latitude: school.coordinates.y,
			longitude: school.coordinates.x,
		};
	}

	return {
		registrationSettings: school.registrationSettings || {
			allowDomainSignups: true,
			requireInvitation: false,
			autoGraduationEnabled: true,
			allowStudentsChooseUsername: true,
		},
		location: school.location,
		coordinates,
	};
});