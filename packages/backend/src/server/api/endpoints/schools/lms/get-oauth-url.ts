import define from '../../../define.js';
import { ApiError } from '../../../error.js';
import { Schools } from '@/models/index.js';
import { BaseLMSAdapter, type LMSCredentials } from '@/services/lms/base-adapter.js';
import { OneRosterAdapter } from '@/services/lms/oneroster-adapter.js';
import { genId } from '@/misc/gen-id.js';
import Logger from '@/services/logger.js';
import config from '@/config/index.js';
import { redisClient } from '@/db/redis.js';

const logger = new Logger('schools-lms-get-oauth-url');

export const meta = {
	tags: ['schools'],

	requireCredential: true,
	requireSchoolAdmin: true,

	description: 'Generate OAuth authorization URL for LMS connection',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			authorizationUrl: {
				type: 'string',
				optional: false,
				nullable: false,
			},
			state: {
				type: 'string',
				optional: false,
				nullable: false,
			},
		},
	},

	errors: {
		accessDenied: {
			message: 'Access denied: School admin access required',
			code: 'ACCESS_DENIED',
			id: 'lms-oauth-url-001',
		},
		schoolNotFound: {
			message: 'School not found',
			code: 'SCHOOL_NOT_FOUND',
			id: 'lms-oauth-url-002',
		},
		lmsNotConfigured: {
			message: 'LMS not configured for this school',
			code: 'LMS_NOT_CONFIGURED',
			id: 'lms-oauth-url-003',
		},
		oauthNotSupported: {
			message: 'OAuth flow not supported for this LMS type',
			code: 'OAUTH_NOT_SUPPORTED',
			id: 'lms-oauth-url-004',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		schoolId: { type: 'string', format: 'campra:id' },
	},
	required: ['schoolId'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Check if user is school admin for this school
	if (!user.isSchoolAdmin || user.adminForSchoolId !== ps.schoolId) {
		throw new ApiError(meta.errors.accessDenied);
	}

	// Find the school
	const school = await Schools.findOneBy({ id: ps.schoolId });
	if (!school) {
		throw new ApiError(meta.errors.schoolNotFound);
	}

	if (!school.metadata?.lms) {
		throw new ApiError(meta.errors.lmsNotConfigured);
	}

	const lmsConfig = school.metadata.lms;

	// Create adapter for OAuth URL generation
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
				id: 'lms-oauth-url-005',
			});
		default:
			throw new ApiError(meta.errors.lmsNotConfigured);
	}

	try {
		// Generate a random state parameter for CSRF protection
		const state = genId();

		// Store state in Redis for validation during callback (10 minute expiration)
		const stateKey = `lms:oauth:state:${state}`;
		await redisClient.set(stateKey, JSON.stringify({
			schoolId: ps.schoolId,
			userId: user.id,
			timestamp: new Date().toISOString(),
		}), 'EX', 600); // 10 minutes

		// Generate OAuth authorization URL
		const redirectUri = `${config.url}/api/schools/lms/oauth-callback`;
		const authorizationUrl = adapter.getAuthorizationUrl(redirectUri, state);

		logger.info(`Generated OAuth authorization URL for school ${ps.schoolId}`);

		return {
			authorizationUrl,
			state,
		};
	} catch (error: any) {
		logger.error(`Failed to generate OAuth URL for school ${ps.schoolId}:`, error);
		throw new ApiError({
			message: 'Failed to generate OAuth authorization URL',
			code: 'OAUTH_URL_GENERATION_FAILED',
			id: 'lms-oauth-url-006',
		});
	}
});
