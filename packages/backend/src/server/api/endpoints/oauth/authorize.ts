import { URL } from 'node:url';
import define from '../../define.js';
import { ApiError } from '../../error.js';
import { AuthSessions, Apps } from '@/models/index.js';
import { genId } from '@/misc/gen-id.js';
import { secureRndstr } from '@/misc/secure-rndstr.js';

export const meta = {
	tags: ['oauth'],
	requireCredential: false,
	secure: false,

	errors: {
		noSuchApp: {
			message: 'No such app.',
			code: 'NO_SUCH_APP',
			id: '70eb6529-d21c-498e-826c-3b1a297d9ab9',
		},
		invalidRedirectUri: {
			message: 'Invalid redirect URI.',
			code: 'INVALID_REDIRECT_URI',
			id: '9ae5723b-5b61-4a59-a28b-f590c3b3a6ee',
		},
		unsupportedResponseType: {
			message: 'Unsupported response type.',
			code: 'UNSUPPORTED_RESPONSE_TYPE',
			id: '63d86ade-d035-4f0f-88b8-e55da0ff5e48',
		},
		invalidScope: {
			message: 'The requested scope exceeds the app\'s registered permissions.',
			code: 'INVALID_SCOPE',
			id: 'f32e25a8-12c2-4f2a-a93d-0d58e945d04e',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		clientId: { type: 'string', format: 'campra:id' },
		redirectUri: { type: 'string' },
		responseType: { type: 'string', enum: ['code'] },
		scope: { type: 'string' },
		state: { type: 'string', nullable: true },
		codeChallenge: { type: 'string', nullable: true },
		codeChallengeMethod: { 
			type: ['string', 'null'],
			enum: ['S256', 'plain', null],
		},
	},
	required: ['clientId', 'redirectUri', 'responseType'],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps, me) => {
	// Find the application
	const app = await Apps.findOneBy({
		id: ps.clientId,
		oauth2: true,
	});

	if (app == null) throw new ApiError(meta.errors.noSuchApp);

	// Validate redirect URI
	const redirectUri = new URL(ps.redirectUri);
	if (!app.redirectUris.includes(redirectUri.origin + redirectUri.pathname)) {
		throw new ApiError(meta.errors.invalidRedirectUri);
	}

	// Currently only 'code' response type is supported
	if (ps.responseType !== 'code') {
		throw new ApiError(meta.errors.unsupportedResponseType);
	}

	// Parse the requested scopes
	const requestedScopes = ps.scope?.split(' ').filter(Boolean) || [];

	// Validate that all requested scopes are within the app's registered permissions
	if (requestedScopes.length > 0) {
		// Check if any requested scope is not included in the app's permissions
		const invalidScopes = requestedScopes.filter(scope => !app.permission.includes(scope));
		
		if (invalidScopes.length > 0) {
			throw new ApiError(meta.errors.invalidScope);
		}
	}

	// Create an authorization session
	const token = secureRndstr(32);

	await AuthSessions.insert({
		id: genId(),
		createdAt: new Date(),
		token: token,
		userId: me?.id ?? null,
		appId: app.id,
		redirectUri: ps.redirectUri,
		scope: requestedScopes,
		codeChallenge: ps.codeChallenge ?? null,
		codeChallengeMethod: ps.codeChallengeMethod ?? null,
	});

	return {
		token,
		url: `${ps.redirectUri}${ps.redirectUri.includes('?') ? '&' : '?'}code=${token}${ps.state ? `&state=${ps.state}` : ''}`,
	};
});
