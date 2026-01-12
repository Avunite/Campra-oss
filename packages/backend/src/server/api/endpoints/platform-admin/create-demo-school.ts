import define from '../../define.js';
import { Schools, Users } from '@/models/index.js';
import { SchoolService } from '@/services/school-service.js';
import { signup } from '../../common/signup.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
	
	description: 'Create a complete demo school with admin and student accounts',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			school: {
				type: 'object',
				optional: false,
				nullable: false,
			},
			admin: {
				type: 'object',
				optional: false,
				nullable: false,
			},
			students: {
				type: 'array',
				optional: false,
				nullable: false,
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		schoolName: { type: 'string', minLength: 1, maxLength: 256 },
		schoolDomain: { type: 'string', minLength: 1, maxLength: 128 },
		schoolType: { 
			type: 'string', 
			enum: ['university', 'college', 'k12', 'trade_school', 'private_school'],
			default: 'university'
		},
		location: { type: 'string', maxLength: 512 },
		adminUsername: { type: 'string', minLength: 1, maxLength: 128 },
		adminPassword: { type: 'string', minLength: 8, maxLength: 128 },
		studentCount: { type: 'number', minimum: 1, maximum: 10, default: 2 },
	},
	required: ['schoolName', 'schoolDomain', 'adminUsername', 'adminPassword'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Validate domain format
	const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
	if (!domainRegex.test(ps.schoolDomain)) {
		throw new ApiError({
			message: 'Invalid domain format',
			code: 'INVALID_DOMAIN',
			id: 'create-demo-school-001',
		});
	}

	// Check if domain already exists
	const existingSchool = await Schools.findOne({
		where: { domain: ps.schoolDomain.toLowerCase() },
	});

	if (existingSchool) {
		throw new ApiError({
			message: 'A school with this domain already exists',
			code: 'DOMAIN_EXISTS',
			id: 'create-demo-school-002',
		});
	}

	// Check if admin username already exists
	const existingAdmin = await Users.findOne({
		where: { 
			usernameLower: ps.adminUsername.toLowerCase(),
			host: null,
		},
	});

	if (existingAdmin) {
		throw new ApiError({
			message: 'A user with this username already exists',
			code: 'USERNAME_EXISTS',
			id: 'create-demo-school-003',
		});
	}

	// Create the demo school
	const school = await SchoolService.createSchool({
		name: ps.schoolName,
		domain: ps.schoolDomain.toLowerCase(),
		type: ps.schoolType || 'university',
		location: ps.location,
		description: `Demo school for platform preview - ${ps.schoolName}`,
	});

	// Mark school as demo
	await Schools.update({ id: school.id }, { isDemo: true });

	// Create initial billing record (but it won't be used for demo)
	await SchoolService.createInitialBilling(school.id);

	// Create demo admin account
	const admin = await signup({
		username: ps.adminUsername,
		password: ps.adminPassword,
	});

	// Update admin to be school admin and mark as demo
	await Users.update({ id: admin.id }, {
		isSchoolAdmin: true,
		schoolId: school.id,
		adminForSchoolId: school.id,
		isDemo: true,
	});

	// Create demo student accounts
	const students = [];
	const studentCount = ps.studentCount || 2;
	
	for (let i = 1; i <= studentCount; i++) {
		const studentUsername = `demo_student${i}_${ps.schoolDomain.split('.')[0]}`;
		const studentPassword = `DemoStudent${i}!`;
		
		const student = await signup({
			username: studentUsername,
			password: studentPassword,
		});

		// Update student to be in school and mark as demo
		await Users.update({ id: student.id }, {
			schoolId: school.id,
			isDemo: true,
			graduationYear: new Date().getFullYear() + 4,
			enrollmentStatus: 'active',
		});

		students.push({
			id: student.id,
			username: studentUsername,
			password: studentPassword, // Return plaintext for super admin to share
		});
	}

	return {
		school: {
			id: school.id,
			name: school.name,
			domain: school.domain,
			type: school.type,
			isDemo: true,
		},
		admin: {
			id: admin.id,
			username: ps.adminUsername,
			password: ps.adminPassword, // Return plaintext for super admin to share
			isSchoolAdmin: true,
		},
		students: students,
	};
});
