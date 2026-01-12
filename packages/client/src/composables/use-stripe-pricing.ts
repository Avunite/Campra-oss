import { ref, onMounted } from 'vue';
import * as os from '@/os';

interface PricingInfo {
	pricePerStudentPerYear: number;
	currency: string;
	billingCycle: string;
}

// Shared state for price caching
const cachedPrice = ref<number | null>(null);
const priceLoading = ref(false);
let pricePromise: Promise<number> | null = null;

/**
 * Composable to fetch and cache the current Stripe price
 * All components should use this instead of hardcoding $15.00
 */
export function useStripePricing() {
	const standardRate = ref<number>(15.00); // Fallback default
	const loading = ref(false);
	const error = ref<Error | null>(null);

	/**
	 * Fetch the current price from Stripe API
	 */
	async function fetchPrice(): Promise<number> {
		// Return cached price if available
		if (cachedPrice.value !== null) {
			return cachedPrice.value;
		}

		// Return existing promise if already loading
		if (pricePromise) {
			return pricePromise;
		}

		// Start new fetch
		priceLoading.value = true;
		loading.value = true;

		pricePromise = (async () => {
			try {
				const response = await os.api('stripe/get-price') as PricingInfo;
				cachedPrice.value = response.pricePerStudentPerYear;
				standardRate.value = response.pricePerStudentPerYear;
				error.value = null;
				return response.pricePerStudentPerYear;
			} catch (e) {
				console.error('Failed to fetch Stripe pricing, using default:', e);
				error.value = e as Error;
				// Use fallback price
				cachedPrice.value = 15.00;
				standardRate.value = 15.00;
				return 15.00;
			} finally {
				priceLoading.value = false;
				loading.value = false;
				pricePromise = null;
			}
		})();

		return pricePromise;
	}

	/**
	 * Clear the price cache (useful for testing or after price updates)
	 */
	function clearCache() {
		cachedPrice.value = null;
		pricePromise = null;
	}

	// Auto-fetch on mount if not already cached
	onMounted(async () => {
		if (cachedPrice.value === null) {
			await fetchPrice();
		} else {
			standardRate.value = cachedPrice.value;
		}
	});

	return {
		standardRate,
		loading,
		error,
		fetchPrice,
		clearCache,
	};
}

/**
 * Get the standard rate synchronously (returns cached value or default)
 * Use this when you need the price immediately without async
 */
export function getStandardRateSync(): number {
	return cachedPrice.value ?? 15.00;
}
