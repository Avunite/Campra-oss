import define from '../../define.js';
import { ApiError } from '../../error.js';
import { Apps, AccessTokens, AuthSessions } from '@/models/index.js';

export const meta = {
	tags: ['app'],

	requireCredential: true,

	kind: 'write:app',

	errors: {
		noSuchApp: {
			message: 'No such app.',
			code: 'NO_SUCH_APP',
			id: '529c686b-bb33-4d36-a94d-b88b72a6cd37',
		},
		notAppOwner: {
			message: 'You do not own this app.',
			code: 'NOT_APP_OWNER',
			id: 'b8fb1873-65f4-4d65-9da6-4d48127558cd',
		},
	},

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			success: {
				type: 'boolean',
				optional: false, nullable: false,
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		appId: { type: 'string', format: 'campra:id' },
	},
	required: ['appId'],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps, user) => {
	// Fetch the app
	const app = await Apps.findOneBy({ id: ps.appId });

	if (app == null) {
		throw new ApiError(meta.errors.noSuchApp);
	}

	// Check if user owns the app
	if (app.userId !== user.id) {
		throw new ApiError(meta.errors.notAppOwner);
	}

	// Clean up related data before removing the app
	if (app.oauth2) {
		// Delete all associated access tokens
		await AccessTokens.delete({ appId: app.id });

		// Delete any pending auth sessions
		await AuthSessions.delete({ appId: app.id });
	}

	// Delete the app
	await Apps.delete(app.id);

	return {
		success: true,
	};
});
