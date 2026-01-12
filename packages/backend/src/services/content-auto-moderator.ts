import { IffyContentModerator, ContentModerationRequest } from './iffy-content-moderator.js';
import { Notes, Users, MessagingMessages, DriveFiles } from '@/models/index.js';
import Logger from '@/services/logger.js';
import { fetchMeta } from '@/misc/fetch-meta.js';

const logger = new Logger('content-auto-moderator');

/**
 * Auto-moderation service that integrates with post creation
 * Automatically scans new content for inappropriate material
 */
export class ContentAutoModerator {
	private moderator: IffyContentModerator | null = null;

	async initialize(): Promise<void> {
		try {
			const meta = await fetchMeta();
			logger.info('Initializing content auto-moderation...', {
				enableContentModeration: meta.enableContentModeration,
				hasIffyApiKey: !!meta.iffyApiKey,
				iffyApiUrl: meta.iffyApiUrl
			});
			
			if (!meta.enableContentModeration || !meta.iffyApiKey) {
				logger.info('Content auto-moderation disabled - not configured in instance settings');
				return;
			}

			this.moderator = await IffyContentModerator.initialize();
			logger.info('Content auto-moderation initialized with Iffy.com successfully');
		} catch (error) {
			logger.error('Content auto-moderation disabled - initialization failed:', { 
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined
			});
		}
	}

	/**
	 * Moderate a new post automatically
	 * Since Iffy uses async ingest API, this submits content for review but allows it to be posted
	 * Actual moderation happens via webhook responses
	 */
	async moderatePost(postId: string, content: string, userId: string): Promise<boolean> {
		if (!this.moderator) {
			// Auto-moderation not available, allow content
			return true;
		}

		try {
			// Get user's school for context
			const user = await Users.findOne({
				where: { id: userId },
				select: ['id', 'schoolId'],
			});

			const request: ContentModerationRequest = {
				content: content,
				contentType: 'text',
				userId: userId,
				contentId: postId,
				schoolId: user?.schoolId || undefined,
			};

			// Submit to Iffy for async moderation (results come via webhook)
			const result = await this.moderator.moderateText(request);
			
			logger.info(`Post ${postId} submitted to Iffy for moderation`, {
				iffyRecordId: result.iffyRecordId,
				iffyUrl: result.iffyUrl,
				category: result.category
			});

			// Since Iffy ingest API is async, we allow content to be posted
			// and handle moderation results via webhook
			return true;
			
		} catch (error) {
			logger.error(`Failed to submit post ${postId} to Iffy:`, { error: error instanceof Error ? error.message : String(error) });
			// On error, allow content but log the issue
			return true;
		}
	}

	/**
	 * Moderate message content (for direct messages)
	 */
	async moderateMessage(messageId: string, content: string, userId: string): Promise<boolean> {
		if (!this.moderator) {
			return true;
		}

		try {
			const user = await Users.findOne({
				where: { id: userId },
				select: ['id', 'schoolId'],
			});

			const request: ContentModerationRequest = {
				content: content,
				contentType: 'text',
				userId: userId,
				contentId: messageId,
				schoolId: user?.schoolId || undefined,
			};

			const result = await this.moderator.moderateText(request);
			
			if (result.flagged) {
				logger.info(`Message ${messageId} flagged by auto-moderation: ${result.reason} (${result.confidence})`);
				
				const meta = await fetchMeta();
				// Delete the message if auto-hide is enabled and confidence is very high
				if (meta.autoHideInappropriateContent && result.confidence > 0.9) {
					await MessagingMessages.update(
						{ id: messageId },
						{ isDeleted: true }
					);
					logger.info(`Message ${messageId} automatically deleted due to very high confidence flag`);
				}

				// Notify school admins
				if (user?.schoolId) {
					await this.notifySchoolModerators(user.schoolId, {
						type: 'contentFlagged',
						contentId: messageId,
						contentType: 'message',
						reason: result.reason,
						confidence: result.confidence,
						category: result.category,
						userId: userId,
						hiddenAutomatically: meta.autoHideInappropriateContent && result.confidence > 0.9,
					});
				}
				
				return false;
			}

			return true;
			
		} catch (error) {
			logger.error(`Failed to moderate message ${messageId}:`, { error: error instanceof Error ? error.message : String(error) });
			return true;
		}
	}

	/**
	 * Moderate image content (for file uploads)
	 * Since Iffy uses async ingest API, this submits content for review but allows it to be uploaded
	 * Actual moderation happens via webhook responses
	 */
	async moderateImage(imageId: string, imageUrl: string, userId: string): Promise<boolean> {
		if (!this.moderator) {
			return true;
		}

		try {
			const user = await Users.findOne({
				where: { id: userId },
				select: ['id', 'schoolId'],
			});

			const request: ContentModerationRequest = {
				content: imageUrl,
				contentType: 'image',
				userId: userId,
				contentId: imageId,
				schoolId: user?.schoolId || undefined,
			};

			// Submit to Iffy for async moderation (results come via webhook)
			const result = await this.moderator.moderateImage(request, imageUrl);
			
			logger.info(`Image ${imageId} submitted to Iffy for moderation`, {
				iffyRecordId: result.iffyRecordId,
				iffyUrl: result.iffyUrl,
				category: result.category
			});

			// Since Iffy ingest API is async, we allow image to be uploaded
			// and handle moderation results via webhook
			return true;
			
		} catch (error) {
			logger.error(`Failed to submit image ${imageId} to Iffy:`, { error: error instanceof Error ? error.message : String(error) });
			return true;
		}
	}

	/**
	 * Notify school moderators about flagged content
	 */
	private async notifySchoolModerators(schoolId: string, data: any): Promise<void> {
		try {
			// Get school admin users
			const schoolAdmins = await Users.find({
				where: { 
					isSchoolAdmin: true,
					adminForSchoolId: schoolId,
				},
				select: ['id', 'username'],
			});

			if (schoolAdmins.length === 0) {
				logger.warn(`No school admins found for school ${schoolId} to notify about flagged content`);
				return;
			}

			// Log notification for each admin
			for (const admin of schoolAdmins) {
				logger.info(`Notifying school admin ${admin.username} (${admin.id}) about flagged content:`, {
					schoolId,
					contentId: data.contentId,
					contentType: data.contentType,
					reason: data.reason,
					confidence: data.confidence,
					hiddenAutomatically: data.hiddenAutomatically,
				});
			}

			// TODO: Send actual notifications (email, push, etc.) to school admins
			// This could integrate with the existing notification system

		} catch (error) {
			logger.error(`Failed to notify school moderators for school ${schoolId}:`, { 
				error: error instanceof Error ? error.message : String(error)
			});
		}
	}

	/**
	 * Check if auto-moderation is available
	 */
	isAvailable(): boolean {
		return this.moderator !== null;
	}

	/**
	 * Re-initialize the moderator (useful for config changes)
	 */
	async reinitialize(): Promise<void> {
		this.moderator = null;
		await this.initialize();
	}
}

// Export singleton instance
export const contentAutoModerator = new ContentAutoModerator();
