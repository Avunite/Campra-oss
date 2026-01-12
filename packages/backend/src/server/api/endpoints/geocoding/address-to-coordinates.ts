import define from '../../define.js';
import { GeocodingService } from '@/services/geocoding.js';

export const meta = {
	tags: ['schools'],
	requireCredential: true,
	requireAdmin: false,
	
	res: {
		type: 'object',
		optional: false, nullable: true,
		properties: {
			latitude: {
				type: 'number',
				optional: false, nullable: false,
			},
			longitude: {
				type: 'number',
				optional: false, nullable: false,
			},
			displayName: {
				type: 'string',
				optional: false, nullable: false,
			},
			confidence: {
				type: 'number',
				optional: false, nullable: false,
			},
		},
	},

	errors: {
		addressRequired: {
			message: 'Address is required',
			code: 'ADDRESS_REQUIRED',
			id: 'geocoding-001',
		},
		geocodingFailed: {
			message: 'Failed to geocode address',
			code: 'GEOCODING_FAILED',
			id: 'geocoding-002',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		address: {
			type: 'string',
			minLength: 1,
			maxLength: 512,
		},
	},
	required: ['address'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	if (!ps.address || ps.address.trim().length === 0) {
		throw new Error('ADDRESS_REQUIRED');
	}

	try {
		const result = await GeocodingService.geocodeAddress(ps.address);
		
		if (!result) {
			throw new Error('GEOCODING_FAILED');
		}

		return result;
	} catch (error) {
		if (error instanceof Error && error.message === 'GEOCODING_FAILED') {
			throw error;
		}
		throw new Error('GEOCODING_FAILED');
	}
});
