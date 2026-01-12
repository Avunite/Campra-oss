import define from '../../define.js';
import { AuthSessions } from '@/models/index.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['account', 'auth'],

	requireCredential: true,

	secure: true,

	errors: {
		noSuchSession: {
			message: 'No such session.',
			code: 'NO_SUCH_SESSION',
			id: '9c72d8de-391a-43c1-9d06-08d29efde8df',
		},
		
		accessDenied: {
			message: 'Access denied.',
			code: 'ACCESS_DENIED',
			id: '1370e5b7-d4eb-4566-bb1d-7748e143096a',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		sessionId: { type: 'string' },
	},
	required: ['sessionId'],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps, user) => {
	// Fetch the session
	const session = await AuthSessions.findOneBy({
		id: ps.sessionId,
	});

	if (session == null) {
		throw new ApiError(meta.errors.noSuchSession);
	}

	// Check if the session belongs to this user
	if (session.userId !== user.id) {
		throw new ApiError(meta.errors.accessDenied);
	}

	// Delete the session
	await AuthSessions.delete(session.id);
});
