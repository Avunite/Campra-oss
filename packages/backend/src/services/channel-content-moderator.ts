import { Users, Channels } from '@/models/index.js';
import { IffyContentModerator } from '@/services/iffy-content-moderator.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import Logger from '@/services/logger.js';

const logger = new Logger('channel-moderator');

export interface ChannelModerationResult {
	needsReview: boolean;
	blocked: boolean;
	allowedWithReview: boolean;
	reason?: string;
	details?: {
		name?: { flagged: boolean; reason?: string };
		description?: { flagged: boolean; reason?: string };
	};
}

export class ChannelContentModerator {
	/**
	 * Check if channel content moderation is enabled
	 */
	static async isEnabled(): Promise<boolean> {
		const meta = await fetchMeta();
		return meta.enableContentModeration && !!meta.iffyApiKey;
	}

	/**
	 * Moderate channel creation/updates
	 */
	static async moderateChannelContent(
		userId: string,
		channelData: {
			name: string;
			description?: string | null;
			schoolId?: string | null;
		}
	): Promise<ChannelModerationResult> {
		if (!(await this.isEnabled())) {
			return { needsReview: false, blocked: false, allowedWithReview: false };
		}

		const user = await Users.findOneBy({ id: userId });
		if (!user) {
			return { needsReview: false, blocked: false, allowedWithReview: false };
		}

		const details: ChannelModerationResult['details'] = {};
		let needsReview = false;
		let blocked = false;

		try {
			const moderator = await IffyContentModerator.initialize();

			// Moderate channel name (more strict than descriptions)
			if (channelData.name) {
				try {
					const nameResult = await moderator.moderateText({
						content: channelData.name,
						contentType: 'text',
						userId: userId,
						contentId: `channel-name-${userId}-${Date.now()}`,
						schoolId: channelData.schoolId || user.schoolId || undefined,
					});

					details.name = {
						flagged: nameResult.flagged || nameResult.category === 'pending',
						reason: nameResult.reason,
					};

					if (details.name.flagged) {
						needsReview = true;
						// For channel names, we might want to be more restrictive
						// But for now, allow with review to maintain user experience
					}
				} catch (error) {
					logger.warn(`Failed to moderate channel name for user ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
				}
			}

			// Moderate channel description
			if (channelData.description) {
				try {
					const descResult = await moderator.moderateText({
						content: channelData.description,
						contentType: 'text',
						userId: userId,
						contentId: `channel-desc-${userId}-${Date.now()}`,
						schoolId: channelData.schoolId || user.schoolId || undefined,
					});

					details.description = {
						flagged: descResult.flagged || descResult.category === 'pending',
						reason: descResult.reason,
					};

					if (details.description.flagged) {
						needsReview = true;
					}
				} catch (error) {
					logger.warn(`Failed to moderate channel description for user ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
				}
			}

		} catch (error) {
			logger.error(`Channel moderation failed for user ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
			// Allow creation to proceed on moderation service failure
			return { needsReview: false, blocked: false, allowedWithReview: false };
		}

		return {
			needsReview,
			blocked,
			allowedWithReview: needsReview, // Allow creation but flag for review
			details,
		};
	}

	/**
	 * Get pending channel moderation items for school admins
	 */
	static async getPendingChannelModerationForSchool(schoolId: string): Promise<Array<{
		channelId: string;
		channelName: string;
		userId: string;
		username: string;
		contentType: string;
		flaggedAt: Date;
		reason: string;
		confidence: number;
	}>> {
		// This would typically query a ContentFlags or similar table
		// For now, returning empty array as placeholder
		// In a full implementation, you'd store pending moderation items in the database
		return [];
	}

	/**
	 * School admin approve or reject channel content
	 */
	static async reviewChannelContent(
		adminId: string,
		channelId: string,
		action: 'approve' | 'reject' | 'suspend',
		reason?: string
	): Promise<{ success: boolean; message?: string }> {
		try {
			const admin = await Users.findOneBy({ id: adminId });
			const channel = await Channels.findOneBy({ id: channelId });

			if (!admin || !channel) {
				return { success: false, message: 'User or channel not found' };
			}

			// Check if admin has permission (school admin for school channels)
			if (channel.schoolId && admin.isSchoolAdmin && admin.adminForSchoolId === channel.schoolId) {
				// School admin can moderate channels in their school
			} else if (admin.isAdmin || admin.isModerator) {
				// Platform admins/moderators can moderate any channel
			} else {
				return { success: false, message: 'Permission denied' };
			}

			// Log the review action
			logger.info(`Admin ${admin.username} ${action}ed channel content for channel ${channel.name}:`, {
				adminId,
				channelId,
				channelName: channel.name,
				action,
				reason: reason || 'No reason provided',
				schoolId: channel.schoolId,
			});

			// Take action based on admin decision
			if (action === 'suspend') {
				await Channels.update(channelId, {
					archive: true, // Archive the channel
				});
				logger.warn(`Channel ${channel.name} (${channelId}) suspended by admin ${admin.username}`);
			} else if (action === 'approve') {
				// Ensure channel is not archived if it was suspended
				await Channels.update(channelId, {
					archive: false,
				});
				logger.info(`Channel ${channel.name} (${channelId}) approved by admin ${admin.username}`);
			}

			// In a full implementation, you'd update the ContentFlags table
			return { success: true };

		} catch (error) {
			logger.error(`Failed to review channel content:`, { error: error instanceof Error ? error.message : String(error) });
			return { success: false, message: 'Review failed' };
		}
	}

	/**
	 * Auto-moderate channel based on school policies
	 */
	static async autoModerateChannel(channelId: string): Promise<{ 
		action: 'none' | 'flag' | 'restrict' | 'suspend';
		reason?: string;
	}> {
		try {
			const channel = await Channels.findOne({
				where: { id: channelId },
				relations: ['user'],
			});

			if (!channel) {
				return { action: 'none' };
			}

			// Check for school-specific policies
			if (channel.schoolId) {
				// Could implement school-specific auto-moderation rules here
				// For example: certain keywords trigger automatic review
				// Or new channels from new users need approval
				
				// For now, just flag for review
				return {
					action: 'flag',
					reason: 'New channel created - pending review',
				};
			}

			return { action: 'none' };

		} catch (error) {
			logger.error(`Auto-moderation failed for channel ${channelId}:`, { error: error instanceof Error ? error.message : String(error) });
			return { action: 'none' };
		}
	}
}

export default ChannelContentModerator;
