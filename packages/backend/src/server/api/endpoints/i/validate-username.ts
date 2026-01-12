import define from '../../define.js';
import { Users } from '@/models/index.js';
import { ApiError } from '../../error.js';
import { UsernameValidator } from '@/services/username-validator.js';

export const meta = {
	tags: ['account'],
	requireCredential: true,
	description: 'Validate a username against the user\'s real name.',
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		username: { 
			type: 'string',
			minLength: 1,
			maxLength: 32,
		},
	},
	required: ['username'],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	// First check basic format validation
	const formatValidation = UsernameValidator.validateUsernameFormat(ps.username);
	if (!formatValidation.isValid) {
		return formatValidation;
	}

	// Check if username is already taken
	const existingUser = await Users.findOne({
		where: {
			usernameLower: ps.username.toLowerCase(),
			host: null, // Only check local users
		},
		select: ['id'],
	});

	if (existingUser && existingUser.id !== me.id) {
		return {
			isValid: false,
			reason: 'Username is already taken',
		};
	}

	// Validate against real name if user has one
	if (me.name) {
		const nameValidation = await UsernameValidator.validateUsernameAgainstName(
			ps.username, 
			me.name, 
			me.id
		);
		
		return nameValidation;
	}

	// If no real name, just return format validation result
	return formatValidation;
});
