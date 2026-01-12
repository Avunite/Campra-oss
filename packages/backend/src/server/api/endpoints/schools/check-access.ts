import define from '../../define.js';
import { SchoolService } from '@/services/school-service.js';

export const meta = {
	tags: ['schools'],
	requireCredential: false,
	
	description: 'Check if access is allowed for a school email domain',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			allowed: {
				type: 'boolean',
				optional: false,
				nullable: false,
			},
			reason: {
				type: 'string',
				optional: true,
				nullable: true,
			},
			school: {
				type: 'object',
				optional: true,
				nullable: true,
				properties: {
					id: { type: 'string', format: 'campra:id' },
					name: { type: 'string' },
					domain: { type: 'string' },
					type: { type: 'string' },
					allowStudentsChooseUsername: { type: 'boolean' },
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		email: { type: 'string' },
	},
	required: ['email'],
} as const;

export default define(meta, paramDef, async (ps) => {
	try {
		// Try the standard validation path first.
		const result = await SchoolService.validateRegistrationEligibility(ps.email);

		return {
			allowed: result.allowed,
			reason: result.reason,
			school: result.school ? {
				id: result.school.id,
				name: result.school.name,
				domain: result.school.domain,
				type: result.school.type,
				allowStudentsChooseUsername: result.school.registrationSettings?.allowStudentsChooseUsername ?? true,
			} : null,
		};
	} catch (error: any) {
		// Accept both literal 'INVALID_EMAIL' errors and ones that contain the
		// phrase 'invalid email' in a case-insensitive manner. Some code paths
		// throw 'INVALID_EMAIL' using uppercase; the regex didn't match that.
		if (error instanceof Error && (/invalid email/i.test(error.message) || /INVALID_EMAIL/.test(error.message))) {
			return {
				allowed: false,
				reason: 'INVALID_EMAIL',
			};
		}

		// If the service threw a known reason code (sometimes thrown instead of
		// returned), try to extract it and return it directly.
		if (error instanceof Error) {
			const knownReasons = [
				'SCHOOL_REGISTRATION_CLOSED',
				'SCHOOL_SUBSCRIPTION_REQUIRED',
				'SCHOOL_NOT_REGISTERED',
				'EMAIL_NOT_WHITELISTED',
				'STUDENT_CAP_REACHED',
				'LMS_NOT_CONFIGURED',
				'LMS_VALIDATION_FAILED',
			];

			for (const r of knownReasons) {
				if (error.message.includes(r)) {
					// Try to include the school data if available, for better UI messaging.
					try {
						const school = await SchoolService.findSchoolByEmailDomain(ps.email);
						return {
							allowed: false,
							reason: r,
							school: school ? {
								id: school.id,
								name: school.name,
								domain: school.domain,
								type: school.type,
								allowStudentsChooseUsername: school.registrationSettings?.allowStudentsChooseUsername ?? true,
							} : null,
						};
					} catch (innerErr) {
						// If we fail to load the school, just return the reason we found.
						return {
							allowed: false,
							reason: r,
						};
					}
				}
			}
		}

		// As a last resort, try to determine if there's a registered school for
		// the given domain and whether signups have been disabled. This allows
		// us to return a helpful 'SCHOOL_REGISTRATION_CLOSED' reason even when
		// validation fails for unexpected reasons (DB hiccup, etc.).
		try {
			const school = await SchoolService.findSchoolByEmailDomain(ps.email);
			if (school && school.registrationSettings && school.registrationSettings.allowDomainSignups === false) {
				return {
					allowed: false,
					reason: 'SCHOOL_REGISTRATION_CLOSED',
					school: {
						id: school.id,
						name: school.name,
						domain: school.domain,
						type: school.type,
						allowStudentsChooseUsername: school.registrationSettings?.allowStudentsChooseUsername ?? true,
					},
				};
			}
		} catch (innerError: any) {
			// ignore - we'll fall back to a generic error below.
		}

		// For any other unexpected error, return a generic error reason so the client can
		// display a non-misleading message and log details server-side.
		console.error('Failed to check school access:', error?.message || error);
		return {
			allowed: false,
			reason: 'ERROR',
		};
	}
});
