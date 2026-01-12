import define from '../../../define.js';
import { ApiError } from '../../../error.js';
import { Schools } from '@/models/index.js';
import { BaseLMSAdapter, type LMSCredentials } from '@/services/lms/base-adapter.js';
import { OneRosterAdapter } from '@/services/lms/oneroster-adapter.js';
import Logger from '@/services/logger.js';
import config from '@/config/index.js';
import { redisClient } from '@/db/redis.js';

const logger = new Logger('schools-lms-oauth-callback');

export const meta = {
	tags: ['schools'],

	requireCredential: true,
	requireSchoolAdmin: true,

	description: 'Handle OAuth callback from LMS provider',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			success: {
				type: 'boolean',
				optional: false,
				nullable: false,
			},
			message: {
				type: 'string',
				optional: false,
				nullable: false,
			},
		},
	},

	errors: {
		invalidRequest: {
			message: 'Invalid OAuth callback request',
			code: 'INVALID_OAUTH_REQUEST',
			id: 'lms-oauth-001',
		},
		noSuchSchool: {
			message: 'School not found',
			code: 'SCHOOL_NOT_FOUND',
			id: 'lms-oauth-002',
		},
		oauthError: {
			message: 'OAuth exchange failed',
			code: 'OAUTH_EXCHANGE_FAILED',
			id: 'lms-oauth-003',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		schoolId: { type: 'string', format: 'campra:id' },
		code: { type: 'string' },
		state: { type: 'string' },
		error: { type: 'string', optional: true },
		errorDescription: { type: 'string', optional: true },
	},
	required: ['schoolId', 'code', 'state'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Validate state parameter against stored value (CSRF protection)
	const stateKey = `lms:oauth:state:${ps.state}`;
	const storedStateData = await redisClient.get(stateKey);

	if (!storedStateData) {
		logger.error(`OAuth callback with invalid or expired state for school ${ps.schoolId}`);
		throw new ApiError(meta.errors.invalidRequest);
	}

	let stateData;
	try {
		stateData = JSON.parse(storedStateData);
	} catch (e) {
		logger.error(`Failed to parse stored state data: ${e}`);
		throw new ApiError(meta.errors.invalidRequest);
	}

	// Verify the state data matches the request
	if (stateData.schoolId !== ps.schoolId || stateData.userId !== user.id) {
		logger.error(`OAuth state mismatch: expected school ${stateData.schoolId} and user ${stateData.userId}, got school ${ps.schoolId} and user ${user.id}`);
		throw new ApiError(meta.errors.invalidRequest);
	}

	// Check if user is school admin for this school
	if (!user.isSchoolAdmin || user.adminForSchoolId !== ps.schoolId) {
		throw new ApiError(meta.errors.invalidRequest);
	}

	// Handle OAuth error response
	if (ps.error) {
		logger.error(`OAuth error for school ${ps.schoolId}: ${ps.error} - ${ps.errorDescription}`);
		// Clean up the state
		await redisClient.del(stateKey);
		throw new ApiError({
			message: ps.errorDescription || ps.error,
			code: 'OAUTH_ERROR',
			id: 'lms-oauth-004',
		});
	}

	// Find the school
	const school = await Schools.findOneBy({ id: ps.schoolId });
	if (!school) {
		await redisClient.del(stateKey);
		throw new ApiError(meta.errors.noSuchSchool);
	}

	if (!school.metadata?.lms) {
		await redisClient.del(stateKey);
		throw new ApiError({
			message: 'LMS configuration not found. Please initiate OAuth flow from the LMS connection page.',
			code: 'LMS_NOT_CONFIGURED',
			id: 'lms-oauth-005',
		});
	}

	const lmsConfig = school.metadata.lms;

	// Create adapter for OAuth token exchange
	const tempCredentials: LMSCredentials = {
		clientId: lmsConfig.clientId,
		clientSecret: lmsConfig.clientSecret,
	};

	let adapter: BaseLMSAdapter;

	switch (lmsConfig.type) {
		case 'oneroster':
			adapter = new OneRosterAdapter(lmsConfig.apiUrl, tempCredentials);
			break;
		case 'blackboard':
		case 'blackbaud':
		case 'canvas':
		case 'powerschool':
			throw new ApiError({
				message: `OAuth flow for ${lmsConfig.type} is not yet implemented. Please use manual credential setup.`,
				code: 'OAUTH_NOT_SUPPORTED',
				id: 'lms-oauth-006',
			});
		default:
			throw new ApiError(meta.errors.invalidRequest);
	}

	try {
		// Exchange authorization code for access token
		const redirectUri = `${config.url}/api/schools/lms/oauth-callback`;
		const credentials = await adapter.exchangeCodeForToken(ps.code, redirectUri);

		// Update school LMS configuration with new credentials
		await Schools.update(ps.schoolId, {
			metadata: {
				...school.metadata,
				lms: {
					...school.metadata.lms,
					accessToken: credentials.accessToken,
					refreshToken: credentials.refreshToken,
					expiresAt: credentials.expiresAt?.toISOString(),
					connectionStatus: 'active',
				},
			},
		});

		// Clean up the state after successful OAuth
		await redisClient.del(stateKey);

		logger.info(`Successfully completed OAuth flow for school ${ps.schoolId}`);

		return {
			success: true,
			message: 'LMS connection established successfully via OAuth',
		};
	} catch (error: any) {
		logger.error(`OAuth token exchange failed for school ${ps.schoolId}:`, error);

		// Clean up the state on error
		await redisClient.del(stateKey);

		// Update connection status to error
		await Schools.update(ps.schoolId, {
			metadata: {
				...school.metadata,
				lms: {
					...school.metadata.lms,
					connectionStatus: 'error',
				},
			},
		});

		throw new ApiError(meta.errors.oauthError);
	}
});
