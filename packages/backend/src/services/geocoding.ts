import { fetchMeta } from '@/misc/fetch-meta.js';
import Logger from '@/services/logger.js';

const logger = new Logger('geocoding');

export interface GeocodingResult {
	latitude: number;
	longitude: number;
	displayName: string;
	confidence: number;
}

export interface GeocodingError {
	error: string;
	message: string;
}

/**
 * Geocoding service to convert addresses to coordinates
 */
export class GeocodingService {
	/**
	 * Convert an address to coordinates
	 */
	public static async geocodeAddress(address: string): Promise<GeocodingResult | null> {
		if (!address || address.trim().length === 0) {
			return null;
		}

		const meta = await fetchMeta();
		
		// Check if we have a Google Maps API key configured
		if (meta.googleMapsApiKey) {
			return this.geocodeWithGoogleMaps(address, meta.googleMapsApiKey);
		}
		
		// Fall back to OpenStreetMap Nominatim (free)
		return this.geocodeWithNominatim(address);
	}

	/**
	 * Geocode using Google Maps API (more accurate, requires API key)
	 */
	private static async geocodeWithGoogleMaps(address: string, apiKey: string): Promise<GeocodingResult | null> {
		try {
			const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
			
			const response = await (globalThis as any).fetch(url);
			const data = await response.json();

			if (data.status === 'OK' && data.results && data.results.length > 0) {
				const result = data.results[0];
				const location = result.geometry.location;

				return {
					latitude: location.lat,
					longitude: location.lng,
					displayName: result.formatted_address,
					confidence: this.calculateGoogleMapsConfidence(result),
				};
			}

			if (data.status === 'ZERO_RESULTS') {
				logger.warn(`No geocoding results found for address: ${address}`);
				return null;
			}

			logger.error(`Google Maps geocoding error: ${data.status} - ${data.error_message || 'Unknown error'}`);
			return null;

		} catch (error) {
			logger.error('Error geocoding with Google Maps:', { error: String(error) });
			return null;
		}
	}

	/**
	 * Geocode using OpenStreetMap Nominatim (free, but less accurate)
	 */
	private static async geocodeWithNominatim(address: string): Promise<GeocodingResult | null> {
		try {
			// Add rate limiting - Nominatim has a 1 request/second limit
			await this.rateLimitNominatim();

			const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1`;
			
			const response = await (globalThis as any).fetch(url, {
				headers: {
					'User-Agent': 'Campra-School-Platform/1.0 (educational platform)',
				},
			});

			const data = await response.json();

			if (data && data.length > 0) {
				const result = data[0];

				return {
					latitude: parseFloat(result.lat),
					longitude: parseFloat(result.lon),
					displayName: result.display_name,
					confidence: parseFloat(result.importance || '0.5'), // Nominatim provides importance as confidence
				};
			}

			logger.warn(`No geocoding results found for address: ${address}`);
			return null;

		} catch (error) {
			logger.error('Error geocoding with Nominatim:', { error: String(error) });
			return null;
		}
	}

	/**
	 * Calculate confidence score for Google Maps results
	 */
	private static calculateGoogleMapsConfidence(result: any): number {
		// Google Maps doesn't provide a direct confidence score
		// We'll estimate based on location type and address components
		
		const locationType = result.geometry.location_type;
		const addressComponents = result.address_components || [];

		// Start with base confidence
		let confidence = 0.7;

		// Adjust based on location type
		switch (locationType) {
			case 'ROOFTOP':
				confidence = 0.95; // Very precise
				break;
			case 'RANGE_INTERPOLATED':
				confidence = 0.85; // Good precision
				break;
			case 'GEOMETRIC_CENTER':
				confidence = 0.75; // Moderate precision
				break;
			case 'APPROXIMATE':
				confidence = 0.6; // Lower precision
				break;
		}

		// Boost confidence for detailed addresses
		const hasStreetNumber = addressComponents.some((comp: any) => comp.types.includes('street_number'));
		const hasRoute = addressComponents.some((comp: any) => comp.types.includes('route'));
		const hasPostalCode = addressComponents.some((comp: any) => comp.types.includes('postal_code'));

		if (hasStreetNumber && hasRoute) confidence += 0.1;
		if (hasPostalCode) confidence += 0.05;

		return Math.min(confidence, 1.0);
	}

	/**
	 * Rate limiting for Nominatim API (1 request per second)
	 */
	private static lastNominatimRequest = 0;
	private static async rateLimitNominatim(): Promise<void> {
		const now = Date.now();
		const timeSinceLastRequest = now - this.lastNominatimRequest;
		const minInterval = 1000; // 1 second

		if (timeSinceLastRequest < minInterval) {
			const waitTime = minInterval - timeSinceLastRequest;
			await new Promise(resolve => (globalThis as any).setTimeout(resolve, waitTime));
		}

		this.lastNominatimRequest = Date.now();
	}

	/**
	 * Reverse geocode coordinates to an address
	 */
	public static async reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
		const meta = await fetchMeta();
		
		// Check if we have a Google Maps API key configured
		if (meta.googleMapsApiKey) {
			return this.reverseGeocodeWithGoogleMaps(latitude, longitude, meta.googleMapsApiKey);
		}
		
		// Fall back to OpenStreetMap Nominatim
		return this.reverseGeocodeWithNominatim(latitude, longitude);
	}

	/**
	 * Reverse geocode using Google Maps API
	 */
	private static async reverseGeocodeWithGoogleMaps(latitude: number, longitude: number, apiKey: string): Promise<string | null> {
		try {
			const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;
			
			const response = await (globalThis as any).fetch(url);
			const data = await response.json();

			if (data.status === 'OK' && data.results && data.results.length > 0) {
				return data.results[0].formatted_address;
			}

			return null;
		} catch (error) {
			logger.error('Error reverse geocoding with Google Maps:', { error: String(error) });
			return null;
		}
	}

	/**
	 * Reverse geocode using OpenStreetMap Nominatim
	 */
	private static async reverseGeocodeWithNominatim(latitude: number, longitude: number): Promise<string | null> {
		try {
			await this.rateLimitNominatim();

			const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`;
			
			const response = await (globalThis as any).fetch(url, {
				headers: {
					'User-Agent': 'Campra-School-Platform/1.0 (educational platform)',
				},
			});

			const data = await response.json();

			if (data && data.display_name) {
				return data.display_name;
			}

			return null;
		} catch (error) {
			logger.error('Error reverse geocoding with Nominatim:', { error: String(error) });
			return null;
		}
	}
}
