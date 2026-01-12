import define from '../../define.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['schools'],
	requireCredential: false,

	description: 'Legacy endpoint - school admin verification is now handled through login flow',

	errors: {
		deprecated: {
			message: 'This endpoint is deprecated. School admins now receive login credentials directly.',
			code: 'DEPRECATED_ENDPOINT',
			id: 'school-admin-deprecated',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		token: {
			type: 'string',
			minLength: 1,
			maxLength: 128,
		},
	},
	required: ['token'],
} as const;

export default define(meta, paramDef, async (ps) => {
	// This endpoint is deprecated - school admins now get temporary passwords
	// and use the normal login flow with forced password change
	throw new ApiError(meta.errors.deprecated);
});