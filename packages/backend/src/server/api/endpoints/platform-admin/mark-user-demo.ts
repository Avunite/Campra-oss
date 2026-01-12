import define from '../../define.js';
import { Users } from '@/models/index.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
	
	description: 'Mark a user as demo or remove demo status',

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
			username: {
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
		userId: { type: 'string', format: 'campra:id' },
		isDemo: { type: 'boolean' },
	},
	required: ['userId', 'isDemo'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Find the user
	const targetUser = await Users.findOne({
		where: { id: ps.userId },
	});

	if (!targetUser) {
		throw new ApiError({
			message: 'User not found',
			code: 'USER_NOT_FOUND',
			id: 'mark-user-demo-001',
		});
	}

	// Update the user's demo status
	await Users.update({ id: ps.userId }, { isDemo: ps.isDemo });

	const updatedUser = await Users.findOneByOrFail({ id: ps.userId });

	return {
		id: updatedUser.id,
		username: updatedUser.username,
		isDemo: updatedUser.isDemo,
	};
});
