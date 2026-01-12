import { performance } from 'perf_hooks';
import Koa from 'koa';
import { CacheableLocalUser, User } from '@/models/entities/user.js';
import { AccessToken } from '@/models/entities/access-token.js';
import { getIpHash } from '@/misc/get-ip-hash.js';
import { limiter } from './limiter.js';
import endpoints, { IEndpointMeta } from './endpoints.js';
import compatibility from './compatibility.js';
import { ApiError } from './error.js';
import { apiLogger } from './logger.js';
import { fetchMeta } from '@/misc/fetch-meta.js';

const accessDenied = {
	message: 'Access denied.',
	code: 'ACCESS_DENIED',
	id: '56f35758-7dd5-468b-8439-5d6fb8ec9b8e',
};

export default async (endpoint: string, user: CacheableLocalUser | null | undefined, token: AccessToken | null | undefined, data: any, ctx?: Koa.Context, headers?: any) => {
	const isSecure = user != null && token == null;
	const isModerator = user != null && (user.isModerator || user.isAdmin);

	const ep = endpoints.find(e => e.name === endpoint) ||
		compatibility.find(e => e.name === endpoint);

	if (ep == null) {
		throw new ApiError({
			message: 'No such endpoint.',
			code: 'NO_SUCH_ENDPOINT',
			id: 'f8080b67-5f9c-4eb7-8c18-7f1eeae8f709',
			httpStatusCode: 404,
		});
	}

	if (ep.meta.secure && !isSecure) {
		throw new ApiError(accessDenied);
	}

	if (ep.meta.limit) {
		let limitActor: string;
		if (user) {
			limitActor = user.id;
		} else {
			limitActor = getIpHash(ctx!.ip);
		}

		const limit = Object.assign({}, ep.meta.limit);

		if (!limit.key) {
			limit.key = ep.name;
		}

		await limiter(limit as IEndpointMeta['limit'] & { key: NonNullable<string> }, limitActor).catch(e => {
			throw new ApiError({
				message: 'Rate limit exceeded. Please try again later.',
				code: 'RATE_LIMIT_EXCEEDED',
				id: 'd5826d14-3982-4d2e-8011-b9e9f02499ef',
				httpStatusCode: 429,
			});
		});
	}

	if (ep.meta.requireCredential && user == null) {
		throw new ApiError({
			message: 'Credential required.',
			code: 'CREDENTIAL_REQUIRED',
			id: '1384574d-a912-4b81-8601-c7b1c4085df1',
			httpStatusCode: 401,
		});
	}

	if (ep.meta.requireCredential && user!.isSuspended) {
		throw new ApiError({
			message: 'Your account has been suspended.',
			code: 'YOUR_ACCOUNT_SUSPENDED',
			id: 'a8c724b3-6e9c-4b46-b1a8-bc3ed6258370',
			httpStatusCode: 403,
		});
	}

	// CAMPRA SCHOOL ACCESS CHECK: Verify school subscription status for authenticated users
	if (ep.meta.requireCredential && user) {
		const { checkSchoolAccess } = await import('./middleware/school-access-check.js');
		const accessCheck = await checkSchoolAccess(user);
		
		if (!accessCheck.hasAccess) {
			// Get user-friendly error message based on school status
			const getErrorMessage = (reason: string) => {
				switch (reason) {
					case 'SCHOOL_SUBSCRIPTION_SUSPENDED':
						return 'Your school\'s Campra subscription has been suspended due to payment issues. Contact your school administration to restore access.';
					case 'SCHOOL_SUBSCRIPTION_CANCELLED':
						return 'Your school\'s Campra subscription has been cancelled. Contact your school administration about reactivating access.';
					case 'SCHOOL_SUBSCRIPTION_INACTIVE':
						return 'Your school\'s Campra subscription is inactive. Contact your school administration to activate access.';
					case 'SCHOOL_PAYMENT_OVERDUE':
						return 'Your school\'s Campra payment is overdue. Contact your school administration to resolve payment issues.';
					default:
						return 'Your school needs an active Campra subscription for access. Contact your school administration to set up billing.';
				}
			};

			throw new ApiError({
				message: getErrorMessage(accessCheck.reason || 'SCHOOL_SUBSCRIPTION_REQUIRED'),
				code: accessCheck.reason || 'SCHOOL_SUBSCRIPTION_REQUIRED',
				id: 'school-access-denied-001',
				httpStatusCode: 403,
			}, {
				schoolStatus: accessCheck.schoolStatus
			});
		}
	}

	if (ep.meta.requireAdmin && !user!.isAdmin) {
		throw new ApiError(accessDenied, { reason: 'You are not the admin.' });
	}

	if (ep.meta.requireModerator && !isModerator) {
		throw new ApiError(accessDenied, { reason: 'You are not a moderator.' });
	}

	// DEMO USER CHECK: Block write operations for demo users
	if (ep.meta.requireCredential && user && user.isDemo) {
		// Allow read operations and demo-specific endpoints
		const isWriteOperation = ep.meta.kind && ep.meta.kind.startsWith('write:');
		const isDeleteOperation = ep.name.includes('delete') || ep.name.includes('remove');
		const isUpdateOperation = ep.name.includes('update') || ep.name.includes('create');
		
		// Block write operations for demo users
		if (isWriteOperation || isDeleteOperation || isUpdateOperation) {
			throw new ApiError({
				message: 'This is a demo account. Write operations are disabled.',
				code: 'DEMO_ACCOUNT_RESTRICTION',
				id: 'demo-account-001',
				httpStatusCode: 403,
			});
		}
	}

	if (token && ep.meta.kind && !token.permission.some(p => p === ep.meta.kind)) {
		throw new ApiError({
			message: 'Your app does not have the necessary permissions to use this endpoint.',
			code: 'PERMISSION_DENIED',
			id: '1370e5b7-d4eb-4566-bb1d-7748ee6a1838',
		});
	}

	const meta = await fetchMeta();
	if (meta.privateMode && ep.meta.requireCredentialPrivateMode && user == null) {
		throw new ApiError({
			message: 'Credential required.',
			code: 'CREDENTIAL_REQUIRED',
			id: '1384574d-a912-4b81-8601-c7b1c4085df1',
			httpStatusCode: 401
		});
	}

	if ((ep.meta.requireFile || ctx?.method === 'GET') && ep.params.properties) {
		for (const k of Object.keys(ep.params.properties)) {
			const param = ep.params.properties![k];
			if (['boolean', 'number', 'integer'].includes(param.type ?? '') && typeof data[k] === 'string') {
				try {
					data[k] = JSON.parse(data[k]);
				} catch (e) {
					throw	new ApiError({
						message: 'Invalid param.',
						code: 'INVALID_PARAM',
						id: '0b5f1631-7c1a-41a6-b399-cce335f34d85',
					}, {
						param: k,
						reason: `cannot cast to ${param.type}`,
					});
				}
			}
		}
	}

	// API invoking
	const before = performance.now();

	// Check if the endpoint requires elevated privileges
	if (ep.meta.requiresElevated) {
		if (!ctx) {
			throw new ApiError({
				message: 'Context is required for elevated endpoints.',
				code: 'CONTEXT_REQUIRED',
				id: '756c894b-4e48-4d56-9a89-c2b2bc0fff8d',
				httpStatusCode: 500,
			});
		}
		
		// For elevated endpoints, pass the full headers
		return await ep.exec(data, user, token, ctx.file, ctx.ip, headers).catch((e: Error) => {
			handleError(e, ep, data);
		}).finally(() => {
			logPerformance(before, ep);
		});
	} else {
		// For non-elevated endpoints, use the existing execution method
		return await ep.exec(data, user, token, ctx?.file, ctx?.ip).catch((e: Error) => {
			handleError(e, ep, data);
		}).finally(() => {
			logPerformance(before, ep);
		});
	}
};

function handleError(e: Error, ep: any, data: any) {
	if (e instanceof ApiError) {
		throw e;
	} else {
		apiLogger.error(`Internal error occurred in ${ep.name}: ${e.message}`, {
			ep: ep.name,
			ps: data,
			e: {
				message: e.message,
				code: e.name,
				stack: e.stack,
			},
		});
		throw new ApiError(null, {
			e: {
				message: e.message,
				code: e.name,
				stack: e.stack,
			},
		});
	}
}

function logPerformance(before: number, ep: any) {
	const after = performance.now();
	const time = after - before;
	if (time > 1000) {
		apiLogger.warn(`SLOW API CALL DETECTED: ${ep.name} (${time}ms)`);
	}
}