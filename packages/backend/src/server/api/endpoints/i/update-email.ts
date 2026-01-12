import { publishMainStream } from '@/services/stream.js';
import define from '../../define.js';
import rndstr from 'rndstr';
import config from '@/config/index.js';
import bcrypt from 'bcryptjs';
import { Users, UserProfiles } from '@/models/index.js';
import { sendEmail } from '@/services/send-email.js';
import { ApiError } from '../../error.js';
import { validateEmailForAccount } from '@/services/validate-email-for-account.js';
import { HOUR } from '@/const.js';

export const meta = {
	requireCredential: true,

	secure: true,

	limit: {
		duration: HOUR,
		max: 3,
	},

	errors: {
		incorrectPassword: {
			message: 'Incorrect password.',
			code: 'INCORRECT_PASSWORD',
			id: 'e54c1d7e-e7d6-4103-86b6-0a95069b4ad3',
		},

		unavailable: {
			message: 'Unavailable email address.',
			code: 'UNAVAILABLE',
			id: 'a2defefb-f220-8849-0af6-17f816099323',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		password: { type: 'string' },
		email: { type: 'string', nullable: true },
	},
	required: ['password'],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps, user) => {
	// CAMPRA PHASE 2: Email changes are disabled for security and billing integrity
	// Email addresses are tied to school domains and billing, so they cannot be changed after registration
	throw new ApiError({
		message: 'Email changes are not allowed. Your email is linked to your school and cannot be modified.',
		code: 'EMAIL_CHANGE_DISABLED',
		id: 'email-change-disabled-campra',
	});
});
