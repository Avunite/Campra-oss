import define from '../../define.js';
import { ApiError } from '../../error.js';
import { Schools, Users } from '@/models/index.js';
import { LocationTimelineService } from '@/services/location-timeline.js';
import { GeocodingService } from '@/services/geocoding.js';
import Logger from '@/services/logger.js';

const logger = new Logger('schools-update-settings');

/**
 * Convert latitude/longitude coordinates to PostgreSQL point format
 */
function formatCoordinatesForDB(coordinates: { latitude: number; longitude: number }): string {
	return `(${coordinates.longitude},${coordinates.latitude})`;
}

export const meta = {
	tags: ['schools'],
	requireCredential: true,

	description: 'Update school settings (school admin only)',

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
			autoGeocodingSucceeded: {
				type: 'boolean',
				optional: false,
				nullable: false,
			},
			settings: {
				type: 'object',
				optional: false,
				nullable: false,
				properties: {
					registrationSettings: {
						type: 'object',
						optional: false,
						nullable: false,
						properties: {
							allowDomainSignups: {
								type: 'boolean',
								optional: false,
								nullable: false,
							},
							requireInvitation: {
								type: 'boolean',
								optional: false,
								nullable: false,
							},
							autoGraduationEnabled: {
								type: 'boolean',
								optional: false,
								nullable: false,
							},
							allowStudentsChooseUsername: {
								type: 'boolean',
								optional: false,
								nullable: false,
							},
							requireLMSValidation: {
								type: 'boolean',
								optional: false,
								nullable: false,
							},
						},
					},
					location: {
						type: 'string',
						optional: true,
						nullable: true,
					},
					coordinates: {
						type: 'object',
						optional: true,
						nullable: true,
						properties: {
							latitude: {
								type: 'number',
								optional: false,
								nullable: false,
							},
							longitude: {
								type: 'number',
								optional: false,
								nullable: false,
							},
						},
					},
				},
			},
		},
	},

	errors: {
		accessDenied: {
			message: 'Access denied: School admin access required',
			code: 'ACCESS_DENIED',
			id: 'school-admin-009',
		},
		schoolNotFound: {
			message: 'School not found',
			code: 'SCHOOL_NOT_FOUND',
			id: 'school-admin-010',
		},
		invalidCoordinates: {
			message: 'Invalid coordinates format',
			code: 'INVALID_COORDINATES',
			id: 'school-admin-011',
		},
		billingNotActive: {
			message: 'Cannot open registration without active billing',
			code: 'BILLING_NOT_ACTIVE',
			id: 'school-admin-012',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		schoolId: { type: 'string', format: 'campra:id' },
		registrationSettings: {
			type: 'object',
			properties: {
				allowDomainSignups: { type: 'boolean' },
				requireInvitation: { type: 'boolean' },
				autoGraduationEnabled: { type: 'boolean' },
				allowStudentsChooseUsername: { type: 'boolean' },
				requireLMSValidation: { type: 'boolean' },
			},
		},
		location: { type: 'string', maxLength: 512 },
		coordinates: {
			type: 'object',
			properties: {
				latitude: { type: 'number', minimum: -90, maximum: 90 },
				longitude: { type: 'number', minimum: -180, maximum: 180 }
			},
			required: ['latitude', 'longitude'],
		},
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

	// Validate coordinates if provided
	if (ps.coordinates) {
		if (typeof ps.coordinates.latitude !== 'number' ||
			typeof ps.coordinates.longitude !== 'number' ||
			ps.coordinates.latitude < -90 || ps.coordinates.latitude > 90 ||
			ps.coordinates.longitude < -180 || ps.coordinates.longitude > 180) {
			throw new ApiError(meta.errors.invalidCoordinates);
		}
	}

	// Prepare update data
	const updateData: any = {};

	// Update registration settings if provided
	if (ps.registrationSettings) {
		const currentSettings = school.registrationSettings || {
			allowDomainSignups: true,
			requireInvitation: false,
			autoGraduationEnabled: true,
			allowStudentsChooseUsername: true,
			requireLMSValidation: false,
		};

		// Check if trying to enable registration (allowDomainSignups)
		if (ps.registrationSettings.allowDomainSignups === true &&
			currentSettings.allowDomainSignups === false) {
			// They're trying to open registration - check billing status using same logic as billing-info
			const { SchoolBillings } = await import('@/models/index.js');

			// Find the billing records for the school
			// Prioritize paid subscriptions over free ones (same as billing-info)
			const allBillings = await SchoolBillings.find({
				where: { schoolId: ps.schoolId },
				order: { createdAt: 'DESC' },
			});

			const billing = allBillings.find((b: any) => b.stripeSubscriptionId) || allBillings[0];

			// Calculate effective status (prioritize school.subscriptionStatus over billing.status)
			// This matches the logic in billing-info.ts
			const effectiveStatus = school.subscriptionStatus || (billing ? billing.status : 'pending');

			// Allow if:
			// 1. School has free access (adminOverride or freeActivation in metadata)
			// 2. Effective billing status is 'active'
			const hasFreeAccess = (school.metadata?.adminOverride || school.metadata?.freeActivation) &&
				!school.metadata?.paidSubscriptionDespiteFree;
			const hasActiveBilling = effectiveStatus === 'active';

			if (!hasFreeAccess && !hasActiveBilling) {
				throw new ApiError(meta.errors.billingNotActive);
			}

			logger.info(`School ${ps.schoolId} opening registration - billing check passed (free: ${hasFreeAccess}, active: ${hasActiveBilling}, effectiveStatus: ${effectiveStatus})`);
		}

		updateData.registrationSettings = {
			...currentSettings,
			...ps.registrationSettings,
		};
	}

	let autoGeocodingSucceeded = false;

	// Update location if provided
	if (ps.location !== undefined) {
		updateData.location = ps.location;

		// Auto-geocode location if coordinates are not provided
		if (ps.location && ps.location.trim().length > 0 && !ps.coordinates) {
			try {
				logger.info(`Auto-geocoding location for school ${ps.schoolId}: ${ps.location}`);
				const geocodingResult = await GeocodingService.geocodeAddress(ps.location);

				if (geocodingResult && geocodingResult.confidence > 0.5) {
					updateData.coordinates = formatCoordinatesForDB({
						latitude: geocodingResult.latitude,
						longitude: geocodingResult.longitude,
					}) as any;
					autoGeocodingSucceeded = true;
					logger.info(`Successfully geocoded location for school ${ps.schoolId}: ${geocodingResult.latitude}, ${geocodingResult.longitude} (confidence: ${geocodingResult.confidence})`);
				} else {
					logger.warn(`Geocoding failed or low confidence for school ${ps.schoolId} location: ${ps.location}`);
				}
			} catch (error) {
				logger.warn(`Failed to auto-geocode location for school ${ps.schoolId}:`, { error: String(error) });
				// Continue without coordinates - this is not a critical error
			}
		}
	}

	// Update coordinates if explicitly provided (overrides auto-geocoded coordinates)
	if (ps.coordinates) {
		updateData.coordinates = formatCoordinatesForDB(ps.coordinates) as any;
	}

	// Update the school
	if (Object.keys(updateData).length > 0) {
		await Schools.update(ps.schoolId, updateData);

		// Clear nearby schools cache if coordinates were updated (either manually or auto-geocoded)
		if (ps.coordinates || (updateData.coordinates && ps.location)) {
			LocationTimelineService.clearNearbySchoolsCache(ps.schoolId);
			LocationTimelineService.clearAllNearbySchoolsCache(); // Clear all cache since proximity relationships changed
		}
	}

	// Fetch updated school data
	const updatedSchool = await Schools.findOneBy({ id: ps.schoolId });
	if (!updatedSchool) {
		throw new Error('SCHOOL_NOT_FOUND');
	}

	// Format coordinates for response
	let coordinates = null;
	if (updatedSchool.coordinates) {
		coordinates = {
			latitude: updatedSchool.coordinates.y,
			longitude: updatedSchool.coordinates.x,
		};
	}

	return {
		success: true,
		autoGeocodingSucceeded,
		settings: {
			registrationSettings: updatedSchool.registrationSettings || {
				allowDomainSignups: true,
				requireInvitation: false,
				autoGraduationEnabled: true,
				allowStudentsChooseUsername: true,
				requireLMSValidation: false,
			},
			location: updatedSchool.location,
			coordinates,
		},
	};
});