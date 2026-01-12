import * as crypto from 'node:crypto';
import define from '../../define.js';
import { ApiError } from '../../error.js';
import { AuthSessions, AccessTokens, Apps } from '@/models/index.js';
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
			id: '36ad1124-aa99-4c1f-8693-be906064e991',
		},
		noSuchSession: {
			message: 'No such session.',
			code: 'NO_SUCH_SESSION',
			id: '5b864652-6ed0-4ea2-9de5-da7e0861a9fd',
		},
		noSuchCode: {
			message: 'No such authorization code.',
			code: 'NO_SUCH_CODE',
			id: 'ce8a5390-0313-4fd2-9be9-b3aaaef4e5c8',
		},
		authorizationExpired: {
			message: 'Authorization code has expired.',
			code: 'AUTHORIZATION_EXPIRED',
			id: '7f214e73-9b8c-4f98-a6a0-c951a41f7a5c',
		},
		invalidRedirectUri: {
			message: 'Invalid redirect URI.',
			code: 'INVALID_REDIRECT_URI',
			id: '91bab962-a3d5-4d9d-82f6-87562cf6a290',
		},
		invalidGrantType: {
			message: 'Invalid grant type.',
			code: 'INVALID_GRANT_TYPE',
			id: 'def863c8-c956-46a3-aa64-89a0c872b9c2',
		},
		invalidCodeVerifier: {
			message: 'Invalid code verifier.',
			code: 'INVALID_CODE_VERIFIER',
			id: 'c574b080-c4ce-4d4b-9791-07f71cf7c996',
		},
		noSuchRefreshToken: {
			message: 'No such refresh token.',
			code: 'NO_SUCH_REFRESH_TOKEN',
			id: '588e7f72-c744-4e4e-b000-3763d5f9d4ef',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		clientId: { type: 'string', format: 'campra:id' },
		clientSecret: { type: 'string' },
		grantType: { type: 'string', enum: ['authorization_code', 'refresh_token'] },
		code: { type: 'string', nullable: true },
		redirectUri: { type: 'string', nullable: true },
		codeVerifier: { type: 'string', nullable: true },
		refreshToken: { type: 'string', nullable: true },
	},
	required: ['clientId', 'clientSecret', 'grantType'],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps) => {
	// Find the application
	const app = await Apps.findOneBy({
		id: ps.clientId,
		secret: ps.clientSecret,
		oauth2: true,
	});

	if (app == null) throw new ApiError(meta.errors.noSuchApp);

	// Handle different grant types
	if (ps.grantType === 'authorization_code') {
		if (!ps.code || !ps.redirectUri) {
			throw new ApiError(meta.errors.invalidGrantType);
		}

		// Fetch the session by code
		const session = await AuthSessions.findOneBy({
			token: ps.code,
			appId: app.id,
		});

		if (session == null) throw new ApiError(meta.errors.noSuchCode);

		// Validate redirect URI
		if (session.redirectUri !== ps.redirectUri) {
			throw new ApiError(meta.errors.invalidRedirectUri);
		}

		// Check authorization code expiration
		if (session.authorizationCodeExpiresAt && new Date() > session.authorizationCodeExpiresAt) {
			throw new ApiError(meta.errors.authorizationExpired);
		}

		// Verify PKCE challenge if provided
		if (session.codeChallenge) {
			if (!ps.codeVerifier) {
				throw new ApiError(meta.errors.invalidCodeVerifier);
			}

			let codeVerifier = ps.codeVerifier;
			if (session.codeChallengeMethod === 'S256') {
				const hash = crypto.createHash('sha256');
				hash.update(codeVerifier);
				codeVerifier = hash.digest('base64')
					.replace(/=/g, '')
					.replace(/\+/g, '-')
					.replace(/\//g, '_');
			}

			if (session.codeChallenge !== codeVerifier) {
				throw new ApiError(meta.errors.invalidCodeVerifier);
			}
		}

		if (!session.userId) throw new ApiError(meta.errors.noSuchSession);

		// Generate access token and refresh token
		const accessToken = secureRndstr(32, true);
		const refreshToken = secureRndstr(32, true);
		const now = new Date();
		const expiresIn = 60 * 60 * 24 * 30; // 30 days in seconds
		const expiresAt = new Date(now.getTime() + expiresIn * 1000);

		// Generate hash for the access token
		const sha256 = crypto.createHash('sha256');
		sha256.update(accessToken + app.secret);
		const hash = sha256.digest('hex');

		// Insert access token
		await AccessTokens.insert({
			id: genId(),
			createdAt: now,
			lastUsedAt: now,
			appId: app.id,
			userId: session.userId,
			token: accessToken,
			hash: hash,
			scope: session.scope,
			expiresAt: expiresAt,
			refreshToken: refreshToken,
		});

		// Delete the authorization session
		await AuthSessions.delete(session.id);

		return {
			accessToken,
			tokenType: 'Bearer',
			expiresIn,
			refreshToken,
			scope: session.scope.join(' '),
		};
	} else if (ps.grantType === 'refresh_token') {
		if (!ps.refreshToken) {
			throw new ApiError(meta.errors.invalidGrantType);
		}

		// Find the token
		const token = await AccessTokens.findOneBy({
			appId: app.id,
			refreshToken: ps.refreshToken,
		});

		if (token == null) throw new ApiError(meta.errors.noSuchRefreshToken);

		// Generate new access token
		const accessToken = secureRndstr(32, true);
		const now = new Date();
		const expiresIn = 60 * 60 * 24 * 30; // 30 days in seconds
		const expiresAt = new Date(now.getTime() + expiresIn * 1000);

		// Generate hash
		const sha256 = crypto.createHash('sha256');
		sha256.update(accessToken + app.secret);
		const hash = sha256.digest('hex');

		// Update token
		await AccessTokens.update(token.id, {
			token: accessToken,
			hash: hash,
			lastUsedAt: now,
			expiresAt: expiresAt,
		});

		return {
			accessToken,
			tokenType: 'Bearer',
			expiresIn,
			refreshToken: token.refreshToken,
			scope: token.scope.join(' '),
		};
	} else {
		throw new ApiError(meta.errors.invalidGrantType);
	}
});
