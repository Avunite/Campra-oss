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
		const apiUrl = meta.iffyApiUrl || 'https://api.iffy.com/v1/moderate';
		const confidenceThreshold = meta.iffyConfidenceThreshold === 'low' ? 0.5 : meta.iffyConfidenceThreshold === 'medium' ? 0.7 : 0.9;
		return new IffyContentModerator(meta.iffyApiKey, apiUrl, confidenceThreshold);
	}

	/**
	 * Moderate text content using iffy.com API
	 */
	async moderateText(request: ContentModerationRequest): Promise<IffyModerationResult> {
		if (request.contentType !== 'text') {
			throw new Error('This method only supports text content');
		}

		try {
			const response = await fetch(this.apiUrl, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${this.apiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					content: request.content,
					type: 'text',
					language: 'en',
					categories: ['hate', 'harassment', 'violence', 'sexual', 'spam'],
				}),
			});

			if (!response.ok) {
				throw new Error(`Iffy API error: ${response.status} ${response.statusText}`);
			}

			const result = await response.json();
			
			const moderationResult: IffyModerationResult = {
				flagged: result.confidence > this.confidenceThreshold,
				confidence: result.confidence,
				category: result.category || 'unknown',
				reason: 'Content flagged by automated moderation',
			};

			// Create content flag if content is flagged
			if (moderationResult.flagged) {
				await this.createContentFlag(request, moderationResult);
			}

			logger.info(`Content moderated: ${request.contentId} - Flagged: ${moderationResult.flagged} (${moderationResult.confidence})`);
			
			return moderationResult;

		} catch (error) {
			logger.error(`Failed to moderate content ${request.contentId}:`, error);
			
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
	 * Moderate image content using iffy.com API
	 */
	async moderateImage(request: ContentModerationRequest, imageUrl: string): Promise<IffyModerationResult> {
		if (request.contentType !== 'image') {
			throw new Error('This method only supports image content');
		}

		try {
			const response = await fetch(this.apiUrl, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${this.apiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					image_url: imageUrl,
					type: 'image',
					categories: ['nudity', 'violence', 'hate_symbols', 'inappropriate'],
				}),
			});

			if (!response.ok) {
				throw new Error(`Iffy API error: ${response.status} ${response.statusText}`);
			}

			const result = await response.json();
			
			const moderationResult: IffyModerationResult = {
				flagged: result.confidence > this.confidenceThreshold,
				confidence: result.confidence,
				category: result.category || 'unknown',
				reason: 'Image flagged by automated moderation',
			};

			// Create content flag if content is flagged
			if (moderationResult.flagged) {
				await this.createContentFlag(request, moderationResult);
			}

			logger.info(`Image moderated: ${request.contentId} - Flagged: ${moderationResult.flagged} (${moderationResult.confidence})`);
			
			return moderationResult;

		} catch (error) {
			logger.error(`Failed to moderate image ${request.contentId}:`, error);
			
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
	 * Create a content flag in the database for manual review
	 */
	private async createContentFlag(
		request: ContentModerationRequest, 
		result: IffyModerationResult
	): Promise<void> {
		try {
			const contentFlag = ContentFlags.create({
				id: genId(),
				userId: request.userId,
				contentId: request.contentId,
				contentType: request.contentType,
				category: result.category,
				confidence: result.confidence,
				reason: result.reason,
				status: 'pending',
				schoolId: request.schoolId || null,
				metadata: {
					automated: true,
					service: 'iffy',
					flaggedAt: new Date().toISOString(),
				},
			});

			await ContentFlags.save(contentFlag);
			logger.info(`Created content flag ${contentFlag.id} for ${request.contentType} ${request.contentId}`);

		} catch (error) {
			logger.error(`Failed to create content flag for ${request.contentId}:`, error);
		}
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

