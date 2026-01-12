import { fetchMeta } from '@/misc/fetch-meta.js';
import { ContentFlags } from '@/models/index.js';
import { genId } from '@/misc/gen-id.js';
import Logger from '@/services/logger.js';
import config from '@/config/index.js';

const logger = new Logger('iffy-content-moderator');

export interface IffyModerationResult {
	flagged: boolean;
	confidence: number;
	category: string;
	reason: string;
	iffyRecordId?: string;
	iffyUrl?: string;
}

export interface ContentModerationRequest {
	content: string;
	contentType: 'text' | 'image' | 'video';
	userId: string;
	contentId: string;
	schoolId?: string;
}

/**
 * Content moderation service using iffy.com API
 */
export class IffyContentModerator {
	private apiKey: string;
	private apiUrl: string;
	private confidenceThreshold: number;

	constructor(apiKey: string, apiUrl: string, confidenceThreshold: number) {
		this.apiKey = apiKey;
		this.apiUrl = apiUrl;
		this.confidenceThreshold = confidenceThreshold;
	}

	/**
	 * Initialize from meta configuration
	 */
	static async initialize(): Promise<IffyContentModerator> {
		const meta = await fetchMeta();
		if (!meta.iffyApiKey) {
			throw new Error('Iffy API key not configured in instance settings');
		}
		const apiUrl = meta.iffyApiUrl || 'https://api.iffy.com/api/v1/ingest';
		const confidenceThreshold = meta.iffyConfidenceThreshold === 'low' ? 0.5 : meta.iffyConfidenceThreshold === 'medium' ? 0.7 : 0.9;
		return new IffyContentModerator(meta.iffyApiKey, apiUrl, confidenceThreshold);
	}

	/**
	 * Submit text content to Iffy for moderation using the ingest API
	 */
	async moderateText(request: ContentModerationRequest): Promise<IffyModerationResult> {
		if (request.contentType !== 'text') {
			throw new Error('This method only supports text content');
		}

		const requestBody = {
			clientId: request.contentId,
			clientUrl: `${config.url}/notes/${request.contentId}`,
			name: `Text content from ${request.userId}`,
			entity: 'post',
			content: {
				text: request.content,
			},
			user: {
				clientId: request.userId,
				name: request.userId, // You might want to get actual username
				username: request.userId,
			},
			metadata: {
				contentType: 'text',
				platform: 'campra',
				timestamp: new Date().toISOString(),
				schoolId: request.schoolId || null,
			},
		};

		try {
			const response = await this.submitToIffy(requestBody);

			// Iffy's ingest API doesn't immediately return moderation results
			// Results come back via webhooks, so we return a pending state
			const result: IffyModerationResult = {
				flagged: false,
				confidence: 0,
				category: 'pending',
				reason: 'Content submitted to Iffy for moderation',
				iffyRecordId: response.id || request.contentId,
				iffyUrl: response.url,
			};

			// Create a content flag for tracking
			await this.createContentFlag(request, result);

			logger.info(`Text content submitted to Iffy: ${request.contentId}`);
			return result;

		} catch (error) {
			logger.error(`Failed to moderate text content ${request.contentId}:`, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				fullError: error
			});

			// Return safe default on API failure
			return {
				flagged: false,
				confidence: 0,
				category: 'error',
				reason: 'Moderation service unavailable',
			};
		}
	}

	/**
	 * Submit image content to Iffy for moderation using the ingest API
	 */
	async moderateImage(request: ContentModerationRequest, imageUrl: string): Promise<IffyModerationResult> {
		if (request.contentType !== 'image') {
			throw new Error('This method only supports image content');
		}

		const requestBody = {
			clientId: request.contentId,
			clientUrl: `${config.url}/files/${request.contentId}`,
			name: `Image content from ${request.userId}`,
			entity: 'image',
			content: {
				imageUrls: [imageUrl],
			},
			user: {
				clientId: request.userId,
				name: request.userId, // You might want to get actual username
				username: request.userId,
			},
			metadata: {
				contentType: 'image',
				platform: 'campra',
				timestamp: new Date().toISOString(),
				schoolId: request.schoolId || null,
			},
		};

		try {
			const response = await this.submitToIffy(requestBody);

			// Iffy's ingest API doesn't immediately return moderation results
			// Results come back via webhooks, so we return a pending state
			const result: IffyModerationResult = {
				flagged: false,
				confidence: 0,
				category: 'pending',
				reason: 'Image submitted to Iffy for moderation',
				iffyRecordId: response.id || request.contentId,
				iffyUrl: response.url,
			};

			// Create a content flag for tracking
			await this.createContentFlag(request, result);

			logger.info(`Image content submitted to Iffy: ${request.contentId}`);
			return result;

		} catch (error) {
			logger.error(`Failed to moderate image content ${request.contentId}:`, { error: error instanceof Error ? error.message : String(error) });

			// Return safe default on API failure
			return {
				flagged: false,
				confidence: 0,
				category: 'error',
				reason: 'Moderation service unavailable',
			};
		}
	}

	/**
	 * Submit content to Iffy's ingest API
	 */
	private async submitToIffy(requestBody: any): Promise<any> {
		logger.info(`Submitting content to Iffy API: ${this.apiUrl}`);
		logger.debug(`Request body:`, requestBody);

		const response = await (globalThis as any).fetch(this.apiUrl, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${this.apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(requestBody),
		});

		if (!response.ok) {
			const errorText = await response.text();
			logger.error(`Iffy API error: ${response.status} ${response.statusText} - ${errorText}`);
			throw new Error(`Iffy API error: ${response.status} ${response.statusText} - ${errorText}`);
		}

		const result = await response.json();
		logger.info(`Iffy API response:`, result);
		return result;
	}

	/**
	 * Create a content flag in the database for tracking
	 */
	private async createContentFlag(
		request: ContentModerationRequest,
		result: IffyModerationResult
	): Promise<void> {
		// Simple logging approach for now since webhook will handle actual flagging
		logger.info(`Content submitted to Iffy for moderation:`, {
			contentId: request.contentId,
			contentType: request.contentType,
			iffyRecordId: result.iffyRecordId,
			iffyUrl: result.iffyUrl,
			note: 'Webhook will create ContentFlag when Iffy responds'
		});

		// Note: The webhook will create the actual ContentFlag record when Iffy responds
		// This ensures we don't have database constraint issues while still getting proper tracking
	}

	/**
	 * Set confidence threshold for flagging content
	 */
	setConfidenceThreshold(threshold: number): void {
		if (threshold < 0 || threshold > 1) {
			throw new Error('Confidence threshold must be between 0 and 1');
		}
		this.confidenceThreshold = threshold;
		logger.info(`Updated confidence threshold to ${threshold}`);
	}

	/**
	 * Delete a record from Iffy (optional cleanup)
	 */
	async deleteRecord(recordId: string): Promise<boolean> {
		try {
			const response = await (globalThis as any).fetch(`${this.apiUrl.replace('/ingest', '/records')}/${recordId}`, {
				method: 'DELETE',
				headers: {
					'Authorization': `Bearer ${this.apiKey}`,
				},
			});

			if (response.ok) {
				logger.info(`Successfully deleted Iffy record ${recordId}`);
				return true;
			} else {
				logger.warn(`Failed to delete Iffy record ${recordId}: ${response.status}`);
				return false;
			}
		} catch (error) {
			logger.error(`Error deleting Iffy record ${recordId}:`, { error: error instanceof Error ? error.message : String(error) });
			return false;
		}
	}

	/**
	 * Get current moderation statistics
	 */
	async getModerationStats(schoolId?: string): Promise<{
		totalFlags: number;
		pendingFlags: number;
		resolvedFlags: number;
		avgConfidence: number;
	}> {
		const query = ContentFlags.createQueryBuilder('flag');

		if (schoolId) {
			query.where('flag.schoolId = :schoolId', { schoolId });
		}

		const [totalFlags, pendingFlags, resolvedFlags] = await Promise.all([
			query.getCount(),
			query.clone().andWhere('flag.status = :status', { status: 'pending' }).getCount(),
			query.clone().andWhere('flag.status = :status', { status: 'resolved' }).getCount(),
		]);

		// Calculate average confidence
		const avgResult = await query
			.select('AVG(flag.confidence)', 'avg')
			.getRawOne();

		const avgConfidence = parseFloat(avgResult?.avg || '0');

		return {
			totalFlags,
			pendingFlags,
			resolvedFlags,
			avgConfidence,
		};
	}
}

export default IffyContentModerator;
