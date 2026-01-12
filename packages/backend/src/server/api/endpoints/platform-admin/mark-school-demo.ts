import define from '../../define.js';
import { Schools, Users } from '@/models/index.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
	
	description: 'Mark a school as demo or remove demo status',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			id: {
				type: 'string',
				optional: false,
				nullable: false,
				format: 'campra:id',
			},
			name: {
				type: 'string',
				optional: false,
				nullable: false,
			},
			isDemo: {
				type: 'boolean',
				optional: false,
				nullable: false,
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		schoolId: { type: 'string', format: 'campra:id' },
		isDemo: { type: 'boolean' },
	},
	required: ['schoolId', 'isDemo'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Find the school
	const school = await Schools.findOne({
		where: { id: ps.schoolId },
	});

	if (!school) {
		throw new ApiError({
			message: 'School not found',
			code: 'SCHOOL_NOT_FOUND',
			id: 'mark-school-demo-001',
		});
	}

	// Update the school's demo status
	await Schools.update({ id: ps.schoolId }, { isDemo: ps.isDemo });

	// Update all users in the school to match demo status
	await Users.update(
		{ schoolId: ps.schoolId },
		{ isDemo: ps.isDemo }
	);

	const updatedSchool = await Schools.findOneByOrFail({ id: ps.schoolId });

	return {
		id: updatedSchool.id,
		name: updatedSchool.name,
		isDemo: updatedSchool.isDemo,
	};
});
