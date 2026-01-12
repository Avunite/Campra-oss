import { Users, UserProfiles } from '@/models/index.js';
import { IffyContentModerator } from '@/services/iffy-content-moderator.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import Logger from '@/services/logger.js';

const logger = new Logger('profile-moderator');

// Local content filtering patterns for immediate blocking
const INAPPROPRIATE_PATTERNS = [
	// Explicit sexual content
	/\b(porn|nude|naked|sex|xxx|tits|ass|pussy|cock|dick|penis|vagina)\b/gi,
	// Hate speech and slurs
	/\b(nigger|faggot|retard|nazi|hitler|kill\s+(yourself|myself))\b/gi,
	// Violence and self-harm
	/\b(suicide|self\s*harm|cut\s*myself|kill\s*myself)\b/gi,
	// Drug references
	/\b(cocaine|heroin|meth|weed|marijuana|drugs|dealer|selling)\b/gi,
	// Profanity (more permissive, only extreme cases)
	/\b(fucking\s+shit|god\s*damn|mother\s*fuck)\b/gi,
];

const SUSPICIOUS_PATTERNS = [
	// Social media handles that might be inappropriate
	/@[a-zA-Z0-9_]{1,15}\.(porn|sex|nude|xxx)/gi,
	// URLs to inappropriate sites
	/https?:\/\/[^\s]+(porn|sex|nude|adult|xxx)[^\s]*/gi,
	// Phone numbers or addresses (privacy concern)
	/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
	/\b\d{1,5}\s+[A-Za-z\s]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|court|ct)\b/gi,
];

export interface ProfileModerationResult {
	needsReview: boolean;
	blockedFields: string[];
	allowedWithReview: boolean;
	blockedContent: {
		name?: boolean;
		description?: boolean;
		fields?: boolean[];
	};
	details?: {
		name?: { flagged: boolean; reason?: string; blocked?: boolean };
		description?: { flagged: boolean; reason?: string; blocked?: boolean };
		fields?: Array<{ name: string; flagged: boolean; reason?: string; blocked?: boolean }>;
	};
}

export class ProfileContentModerator {
	/**
	 * Check if profile content moderation is enabled
	 */
	static async isEnabled(): Promise<boolean> {
		const meta = await fetchMeta();
		return meta.enableContentModeration && !!meta.iffyApiKey;
	}

	/**
	 * Perform local content filtering for immediate blocking
	 */
	private static checkLocalPatterns(content: string): { 
		shouldBlock: boolean; 
		shouldFlag: boolean; 
		reason: string; 
	} {
		if (!content || content.trim().length === 0) {
			return { shouldBlock: false, shouldFlag: false, reason: 'Empty content' };
		}

		// Check for inappropriate patterns that should be immediately blocked
		for (const pattern of INAPPROPRIATE_PATTERNS) {
			if (pattern.test(content)) {
				return { 
					shouldBlock: true, 
					shouldFlag: true, 
					reason: 'Contains inappropriate content that violates community guidelines' 
				};
			}
		}

		// Check for suspicious patterns that should be flagged for review
		for (const pattern of SUSPICIOUS_PATTERNS) {
			if (pattern.test(content)) {
				return { 
					shouldBlock: false, 
					shouldFlag: true, 
					reason: 'Contains potentially problematic content that needs review' 
				};
			}
		}

		// Check for excessive length that might be spam
		if (content.length > 2000) {
			return { 
				shouldBlock: false, 
				shouldFlag: true, 
				reason: 'Content is unusually long and may be spam' 
			};
		}

		// Check for repeated characters (spam indicator)
		const repeatedCharPattern = /(.)\1{10,}/g;
		if (repeatedCharPattern.test(content)) {
			return { 
				shouldBlock: true, 
				shouldFlag: true, 
				reason: 'Contains excessive repeated characters (spam pattern)' 
			};
		}

		// Check for too many URLs
		const urlPattern = /https?:\/\/[^\s]+/g;
		const urlMatches = content.match(urlPattern);
		if (urlMatches && urlMatches.length > 3) {
			return { 
				shouldBlock: false, 
				shouldFlag: true, 
				reason: 'Contains multiple URLs which may be spam' 
			};
		}

		return { shouldBlock: false, shouldFlag: false, reason: 'Content appears appropriate' };
	}

	/**
	 * Moderate profile content updates
	 */
	static async moderateProfileUpdate(
		userId: string,
		updates: {
			name?: string | null;
			description?: string | null;
			fields?: Array<{ name: string; value: string }>;
		}
	): Promise<ProfileModerationResult> {
		if (!(await this.isEnabled())) {
			return { 
				needsReview: false, 
				blockedFields: [], 
				allowedWithReview: false,
				blockedContent: {}
			};
		}

		const user = await Users.findOneBy({ id: userId });
		if (!user) {
			return { 
				needsReview: false, 
				blockedFields: [], 
				allowedWithReview: false,
				blockedContent: {}
			};
		}

		const blockedFields: string[] = [];
		const details: ProfileModerationResult['details'] = {};
		const blockedContent: ProfileModerationResult['blockedContent'] = {};
		let needsReview = false;

		try {
			const moderator = await IffyContentModerator.initialize();

			// Moderate display name
			if (updates.name !== undefined && updates.name) {
				try {
					// First, check local patterns for immediate action
					const localCheck = this.checkLocalPatterns(updates.name);
					
					let shouldBlock = localCheck.shouldBlock;
					let needsReviewFlag = localCheck.shouldFlag;
					let reason = localCheck.reason;

					// If local check passes, also submit to Iffy for detailed analysis
					if (!shouldBlock && !needsReviewFlag) {
						const nameResult = await moderator.moderateText({
							content: updates.name,
							contentType: 'text',
							userId: userId,
							contentId: `profile-name-${userId}`,
							schoolId: user.schoolId || undefined,
						});

						// Since Iffy returns pending, we don't block but do flag for review
						if (nameResult.category === 'pending') {
							needsReviewFlag = true;
							reason = nameResult.reason || 'Submitted for detailed content review';
						}
					}
					
					if (shouldBlock || needsReviewFlag) {
						needsReview = true;
						details.name = {
							flagged: true,
							reason: reason,
							blocked: shouldBlock,
						};
						
						if (shouldBlock) {
							blockedContent.name = true;
							blockedFields.push('name');
							logger.warn(`Blocked inappropriate name for user ${userId}: "${updates.name}" - ${reason}`);
						} else {
							logger.info(`Flagged name for review for user ${userId}: "${updates.name}" - ${reason}`);
						}
					}
				} catch (error) {
					logger.warn(`Failed to moderate profile name for user ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
				}
			}

			// Moderate bio/description
			if (updates.description !== undefined && updates.description) {
				try {
					// First, check local patterns for immediate action
					const localCheck = this.checkLocalPatterns(updates.description);
					
					let shouldBlock = localCheck.shouldBlock;
					let needsReviewFlag = localCheck.shouldFlag;
					let reason = localCheck.reason;

					// If local check passes, also submit to Iffy for detailed analysis
					if (!shouldBlock && !needsReviewFlag) {
						const descResult = await moderator.moderateText({
							content: updates.description,
							contentType: 'text',
							userId: userId,
							contentId: `profile-bio-${userId}`,
							schoolId: user.schoolId || undefined,
						});

						// Since Iffy returns pending, we don't block but do flag for review
						if (descResult.category === 'pending') {
							needsReviewFlag = true;
							reason = descResult.reason || 'Submitted for detailed content review';
						}
					}

					if (shouldBlock || needsReviewFlag) {
						needsReview = true;
						details.description = {
							flagged: true,
							reason: reason,
							blocked: shouldBlock,
						};
						
						if (shouldBlock) {
							blockedContent.description = true;
							blockedFields.push('description');
							logger.warn(`Blocked inappropriate description for user ${userId}: "${updates.description.substring(0, 100)}..." - ${reason}`);
						} else {
							logger.info(`Flagged description for review for user ${userId}: "${updates.description.substring(0, 100)}..." - ${reason}`);
						}
					}
				} catch (error) {
					logger.warn(`Failed to moderate profile description for user ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
				}
			}

			// Moderate profile fields
			if (updates.fields) {
				details.fields = [];
				blockedContent.fields = [];
				for (const [index, field] of updates.fields.entries()) {
					const fieldName = field.name.trim();
					const fieldValue = field.value.trim();
					
					if (!fieldName && !fieldValue) {
						blockedContent.fields.push(false);
						continue;
					}

					try {
						// Moderate both field name and value
						const fieldContent = `${fieldName}: ${fieldValue}`;
						
						// First, check local patterns for immediate action
						const localCheck = this.checkLocalPatterns(fieldContent);
						
						let shouldBlock = localCheck.shouldBlock;
						let needsReviewFlag = localCheck.shouldFlag;
						let reason = localCheck.reason;

						// If local check passes, also submit to Iffy for detailed analysis
						if (!shouldBlock && !needsReviewFlag) {
							const fieldResult = await moderator.moderateText({
								content: fieldContent,
								contentType: 'text',
								userId: userId,
								contentId: `profile-field-${userId}-${index}`,
								schoolId: user.schoolId || undefined,
							});

							// Since Iffy returns pending, we don't block but do flag for review
							if (fieldResult.category === 'pending') {
								needsReviewFlag = true;
								reason = fieldResult.reason || 'Submitted for detailed content review';
							}
						}

						const fieldDetails = {
							name: fieldName,
							flagged: shouldBlock || needsReviewFlag,
							reason: reason,
							blocked: shouldBlock,
						};

						details.fields.push(fieldDetails);
						blockedContent.fields.push(shouldBlock);

						if (fieldDetails.flagged) {
							needsReview = true;
						}
						
						if (shouldBlock) {
							blockedFields.push(`field-${index}`);
							logger.warn(`Blocked inappropriate field for user ${userId}: "${fieldName}: ${fieldValue}" - ${reason}`);
						} else if (needsReviewFlag) {
							logger.info(`Flagged field for review for user ${userId}: "${fieldName}: ${fieldValue}" - ${reason}`);
						}
					} catch (error) {
						logger.warn(`Failed to moderate profile field ${index} for user ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
						blockedContent.fields.push(false);
					}
				}
			}

		} catch (error) {
			logger.error(`Profile moderation failed for user ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
			// Allow update to proceed on moderation service failure
			return { 
				needsReview: false, 
				blockedFields: [], 
				allowedWithReview: false,
				blockedContent: {}
			};
		}

		return {
			needsReview,
			blockedFields,
			allowedWithReview: needsReview && blockedFields.length === 0, // Allow if flagged but not blocked
			blockedContent,
			details,
		};
	}

	/**
	 * Moderate avatar/banner image upload
	 */
	static async moderateProfileImage(
		userId: string, 
		imageUrl: string, 
		imageType: 'avatar' | 'banner'
	): Promise<{ needsReview: boolean; blocked: boolean; reason?: string }> {
		if (!(await this.isEnabled())) {
			return { needsReview: false, blocked: false };
		}

		const user = await Users.findOneBy({ id: userId });
		if (!user) {
			return { needsReview: false, blocked: false };
		}

		try {
			const moderator = await IffyContentModerator.initialize();
			
			const result = await moderator.moderateImage({
				content: imageUrl,
				contentType: 'image',
				userId: userId,
				contentId: `profile-${imageType}-${userId}`,
				schoolId: user.schoolId || undefined,
			}, imageUrl);

			// For profile images, we generally allow them but flag inappropriate ones for review
			return {
				needsReview: result.flagged || result.category === 'pending',
				blocked: false, // Don't block profile images, just review
				reason: result.reason,
			};

		} catch (error) {
			logger.error(`Profile image moderation failed for user ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
			// Allow image on moderation service failure
			return { needsReview: false, blocked: false };
		}
	}

	/**
	 * Get pending profile moderation items for school admins
	 */
	static async getPendingModerationForSchool(schoolId: string): Promise<Array<{
		userId: string;
		username: string;
		name: string | null;
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
	 * School admin approve or reject profile content
	 */
	static async reviewProfileContent(
		adminId: string,
		targetUserId: string,
		action: 'approve' | 'reject' | 'suspend',
		reason?: string
	): Promise<{ success: boolean; message?: string }> {
		try {
			const admin = await Users.findOneBy({ id: adminId });
			const targetUser = await Users.findOneBy({ id: targetUserId });

			if (!admin || !targetUser) {
				return { success: false, message: 'User not found' };
			}

			if (!admin.isSchoolAdmin || admin.adminForSchoolId !== targetUser.schoolId) {
				return { success: false, message: 'Permission denied' };
			}

		// Log the review action
		logger.info(`School admin ${admin.username} ${action}ed profile content for ${targetUser.username}:`, {
			adminId,
			targetUserId,
			action,
			reason: reason || 'No reason provided',
			schoolId: admin.adminForSchoolId,
		});

		// Take action based on admin decision
		if (action === 'suspend') {
			// Suspend the user (this could involve various actions like limiting posting, etc.)
			await Users.update(targetUserId, {
				isSuspended: true,
				updatedAt: new Date(),
			});
			logger.warn(`User ${targetUser.username} (${targetUserId}) suspended by school admin ${admin.username}`);
		} else if (action === 'approve') {
			// Clear any suspension if it was previously suspended
			await Users.update(targetUserId, {
				isSuspended: false,
				updatedAt: new Date(),
			});
			logger.info(`User ${targetUser.username} (${targetUserId}) profile approved by school admin ${admin.username}`);
		} else if (action === 'reject') {
			// For rejection, we might want to notify the user or require changes
			// For now, just log the rejection
			logger.info(`User ${targetUser.username} (${targetUserId}) profile rejected by school admin ${admin.username}`);
		}

		// In a full implementation, you'd update the ContentFlags table
		// and potentially take action on the user's profile

		return { success: true };		} catch (error) {
			logger.error(`Failed to review profile content:`, { error: error instanceof Error ? error.message : String(error) });
			return { success: false, message: 'Review failed' };
		}
	}
}

export default ProfileContentModerator;
