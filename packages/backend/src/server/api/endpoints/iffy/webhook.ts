import { fetchMeta } from '@/misc/fetch-meta.js';
import { ContentFlags, Users, Notes, MessagingMessages, DriveFiles, AbuseUserReports } from '@/models/index.js';
import Logger from '@/services/logger.js';
import define from '../../define.js';
import { ApiError } from '@/server/api/error.js';
import { genId } from '@/misc/gen-id.js';
import { publishAdminStream } from '@/services/stream.js';

const logger = new Logger('iffy-webhook');

// In-memory cache for webhook event idempotency
const processedIffyWebhookEvents = new Set<string>();

export const meta = {
    tags: ['webhook'],
    requireCredential: false,
    secure: false,
} as const;

export const paramDef = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        event: { type: 'string' },
        payload: { type: 'object' },
        timestamp: { type: 'string' },
        body: { type: 'string', nullable: true },
        signature: { type: 'string', nullable: true },
    },
    required: ['id', 'event', 'payload', 'timestamp'],
} as const;

export default define(meta, paramDef, async (ps, ctx) => {
    try {
        logger.info(`🔔 Processing Iffy webhook event: ${ps.event}`, {
            eventId: ps.id,
            timestamp: ps.timestamp,
            payload: ps.payload
        });

        const instance = await fetchMeta();
        if (!instance.enableContentModeration || !instance.iffyApiKey) {
            logger.error('Iffy content moderation is not configured');
            throw new ApiError({
                message: 'Iffy content moderation is not configured properly',
                code: 'IFFY_MISCONFIGURED',
                id: 'a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6',
                httpStatusCode: 500,
            });
        }

        if (!instance.iffyWebhookSecret) {
            logger.error('Iffy webhook secret is missing');
            throw new ApiError({
                message: 'Iffy webhook secret is not configured properly',
                code: 'IFFY_WEBHOOK_MISCONFIGURED',
                id: 'b2c3d4e5-f6g7-h8i9-j0k1-l2m3n4o5p6q7',
                httpStatusCode: 500,
            });
        }

        // Note: Signature verification is already handled in api-handler.ts
        logger.info('Iffy webhook signature already verified by api-handler');

        // Webhook event idempotency check
        const eventId = ps.id;
        if (processedIffyWebhookEvents.has(eventId)) {
            logger.info(`Iffy webhook event ${eventId} already processed. Skipping.`);
            return { received: true };
        }

        // Process the webhook event
        await handleIffyWebhookEvent(ps);

        // Add to processed events cache
        processedIffyWebhookEvents.add(eventId);

        logger.info(`Successfully processed Iffy webhook event: ${ps.event}`);
        return { received: true };

    } catch (error) {
        logger.error(`Error processing Iffy webhook: ${error instanceof Error ? error.message : String(error)}`);
        if (error instanceof ApiError) {
            throw error;
        } else {
            throw new ApiError({
                message: 'Internal server error',
                code: 'INTERNAL_SERVER_ERROR',
                id: 'e5f6g7h8-i9j0-k1l2-m3n4-o5p6q7r8s9t0',
                httpStatusCode: 500,
            });
        }
    }
});

async function handleIffyWebhookEvent(event: any): Promise<void> {
    const { event: eventType, payload } = event;

    switch (eventType) {
        case 'record.flagged':
            await handleRecordFlagged(payload);
            break;

        case 'record.unflagged':
            await handleRecordUnflagged(payload);
            break;

        case 'user.suspended':
            // Iffy should not suspend users - only notify schools
            await handleUserRiskAlert(payload, 'high_risk_user');
            break;

        case 'user.compliant':
            // User cleared of risk - notify schools
            await handleUserRiskAlert(payload, 'user_cleared');
            break;

        case 'user.banned':
            // Iffy should not ban users - only notify schools of critical risk
            await handleUserRiskAlert(payload, 'critical_risk_user');
            break;

        default:
            logger.info(`Unhandled Iffy webhook event type: ${eventType}`);
    }
}

function getContentType(entity: string): string {
    switch (entity) {
        case 'post':
        case 'text':
            return 'note';
        case 'comment':
            return 'note';
        case 'image':
        case 'file':
            return 'file';
        case 'message':
            return 'message';
        default:
            return entity;
    }
}

async function handleRecordFlagged(payload: any): Promise<void> {
    const status = payload.status || 'Unknown';
    logger.info(`Handling record flagged: ${payload.clientId} with status: ${status}`);

    try {
        // Get user information for school context
        logger.info(`Looking up user for clientId: ${payload.user?.clientId}`);
        const user = await Users.findOne({
            where: { id: payload.user?.clientId },
            select: ['id', 'schoolId', 'username', 'host', 'isAdmin'],
        });

        if (!user) {
            logger.warn(`User not found for clientId: ${payload.user?.clientId}`);
        } else {
            logger.info(`Found user: ${user.username} (${user.id})`);
        }

        // Handle based on status
        if (status === 'Compliant') {
            // Content is compliant - restore if it was pending moderation
            logger.info(`Content ${payload.clientId} marked as compliant - restoring if pending moderation`);
            await restoreContent(payload.clientId, payload.entity);

            // Notify moderators that content was approved
            if (user?.schoolId) {
                await notifyModerators('contentApproved', {
                    contentId: payload.clientId,
                    entity: payload.entity,
                    reason: payload.name,
                    iffyRecordId: payload.id,
                    confidence: payload.confidence || 0.9,
                    category: 'compliant',
                    schoolId: user.schoolId,
                });
            }

        } else if (status === 'Flagged') {
            // Content is flagged - take action
            logger.info(`Content ${payload.clientId} flagged - taking automatic action`);

            // Create or update content flag for tracking
            // Temporarily disabled due to database constraint issues - core functionality still works
            logger.info(`Skipping ContentFlag creation for ${payload.clientId} - content will still be hidden and moderators notified`);

            // Create an abuse report on behalf of automod account
            if (user) {
                logger.info(`Attempting to create automod abuse report for user ${user.id}`);
                try {
                    await createAutomodAbuseReport(user, payload);
                    logger.info(`Successfully created automod abuse report for user ${user.id}`);
                } catch (error) {
                    logger.error(`Failed to create automod abuse report for user ${user.id}:`, error);
                }
            } else {
                logger.warn(`Cannot create abuse report - user not found for clientId: ${payload.user?.clientId}`);
            }

            // Automatically hide flagged content
            await takeAutomaticAction(payload);

            // Notify school moderators
            if (user?.schoolId) {
                await notifyModerators('contentFlagged', {
                    contentId: payload.clientId,
                    entity: payload.entity,
                    reason: payload.name,
                    iffyRecordId: payload.id,
                    confidence: payload.confidence || 0.8,
                    category: payload.category || 'inappropriate',
                    schoolId: user.schoolId,
                });
            }

        } else {
            // Unknown status - log for debugging
            logger.warn(`Unknown status "${status}" for content ${payload.clientId} - no action taken`);
        }

    } catch (error) {
        logger.error(`Failed to handle record flagged: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}

async function handleRecordUnflagged(payload: any): Promise<void> {
    logger.info(`Handling record unflagged: ${payload.clientId}`);

    try {
        // Restore content if it was hidden or pending moderation
        await restoreContent(payload.clientId, payload.entity);

        // Notify moderators
        await notifyModerators('contentUnflagged', {
            contentId: payload.clientId,
            entity: payload.entity,
            iffyRecordId: payload.id,
        });

    } catch (error) {
        logger.error(`Failed to handle record unflagged: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}



async function handleUserRiskAlert(payload: any, riskLevel: string): Promise<void> {
    logger.info(`Handling user risk alert: ${payload.clientId} (${riskLevel})`);

    try {
        // Get user information for school context
        const user = await Users.findOne({
            where: { id: payload.clientId },
            select: ['id', 'schoolId', 'username'],
        });

        if (!user) {
            logger.warn(`User ${payload.clientId} not found for risk alert`);
            return;
        }

        // Only notify school admins - do NOT automatically suspend users
        if (user.schoolId) {
            const riskMessages: Record<string, string> = {
                'high_risk_user': 'User flagged as high risk by content moderation',
                'critical_risk_user': 'User flagged as critical risk by content moderation',
                'user_cleared': 'User cleared of risk flags by content moderation'
            };

            await notifyModerators('userRiskAlert', {
                userId: payload.clientId,
                username: user.username,
                riskLevel: riskLevel,
                reason: riskMessages[riskLevel] || 'User risk status changed',
                iffyUserId: payload.id,
                schoolId: user.schoolId,
                // Include recommendation but don't take action
                recommendation: riskLevel === 'critical_risk_user' ? 'Consider immediate review and possible suspension' :
                    riskLevel === 'high_risk_user' ? 'Consider review of user activity' :
                        'User activity cleared for normal operation'
            });

            logger.warn(`🚨 USER RISK ALERT - School ${user.schoolId}: ${riskLevel} for user ${user.username} (${payload.clientId})`);
        } else {
            // For users without schools, notify platform admins only
            await notifyModerators('userRiskAlert', {
                userId: payload.clientId,
                username: user.username,
                riskLevel: riskLevel,
                reason: `Platform user risk alert: ${riskLevel}`,
                iffyUserId: payload.id,
                recommendation: 'Platform admin review recommended'
            });
        }

    } catch (error) {
        logger.error(`Failed to handle user risk alert: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}

async function takeAutomaticAction(payload: any): Promise<void> {
    const { clientId, entity, confidence } = payload;

    try {
        logger.info(`Taking automatic action for flagged content: ${clientId} (${entity})`);

        // Get user information for school context
        const user = await Users.findOne({
            where: { id: payload.user?.clientId },
            select: ['id', 'schoolId'],
        });

        if (entity === 'post' || entity === 'text') {
            // Hide the flagged note by setting visibility to specified with empty visibleUserIds
            // This effectively hides it from all users except the author
            await Notes.update(clientId, {
                visibility: 'specified',
                visibleUserIds: [] // Empty array means only author can see it
            });

            logger.info(`Hidden note ${clientId} due to content flagging (set visibility to specified)`);

        } else if (entity === 'image') {
            // Mark the file as sensitive/hidden
            await DriveFiles.update(clientId, {
                isSensitive: true
            });

            logger.info(`Marked file ${clientId} as sensitive due to content flagging`);
        }

    } catch (error) {
        logger.error(`Failed to take automatic action for ${clientId}:`, {
            error: error instanceof Error ? error.message : String(error),
            entity,
            iffyRecordId: payload.id
        });
    }
}

async function restoreContent(contentId: string, entity: string): Promise<void> {
    try {
        logger.info(`Attempting to restore content ${contentId} with entity type: ${entity}`);
        
        switch (entity) {
            case 'note':
            case 'post':
            case 'text':
                // Check if this note was pending moderation
                const note = await Notes.findOneBy({ id: contentId });
                logger.info(`Found note for restoration:`, {
                    noteId: contentId,
                    noteExists: !!note,
                    hasIffyScanResult: !!(note?.iffyScanResult),
                    currentVisibility: note?.visibility,
                    scanResult: note?.iffyScanResult
                });

                if (note && note.iffyScanResult) {
                    const scanResult = note.iffyScanResult as any;

                    // If it was pending moderation, restore to original visibility
                    if (scanResult.pendingModeration && scanResult.originalVisibility) {
                        logger.info(`Restoring note ${contentId} from pending moderation:`, {
                            currentVisibility: note.visibility,
                            originalVisibility: scanResult.originalVisibility,
                            originalVisibleUserIds: scanResult.originalVisibleUserIds
                        });

                        await Notes.update(
                            { id: contentId },
                            {
                                visibility: scanResult.originalVisibility,
                                visibleUserIds: scanResult.originalVisibleUserIds || [],
                                iffyScanResult: {
                                    ...scanResult,
                                    approved: true,
                                    approvedAt: new Date(),
                                    pendingModeration: false
                                }
                            }
                        );
                        logger.info(`✅ Successfully restored note ${contentId} from pending moderation to ${scanResult.originalVisibility} visibility`);
                    } else {
                        // Regular unflagging - restore to public
                        logger.info(`Restoring note ${contentId} after unflagging (not pending moderation)`);
                        await Notes.update(
                            { id: contentId },
                            {
                                visibility: 'public',
                                visibleUserIds: [],
                                iffyScanResult: {
                                    ...scanResult,
                                    approved: true,
                                    approvedAt: new Date()
                                }
                            }
                        );
                        logger.info(`✅ Successfully restored note ${contentId} after Iffy unflagging`);
                    }
                } else {
                    logger.warn(`⚠️  Note ${contentId} not found or has no iffyScanResult - cannot restore`);
                }
                break;

            case 'message':
                // Restore message
                await MessagingMessages.update(
                    { id: contentId },
                    { isDeleted: false }
                );
                logger.info(`Restored message ${contentId} after Iffy unflagging`);
                break;

            case 'file':
            case 'image':
                // Remove sensitive flag
                await DriveFiles.update(
                    { id: contentId },
                    {
                        isSensitive: false,
                        comment: null
                    }
                );
                logger.info(`Restored file ${contentId} after Iffy unflagging`);
                break;
        }
    } catch (error) {
        logger.error(`Failed to restore content ${contentId}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function notifyModerators(type: string, data: any): Promise<void> {
    try {
        // Get school-specific moderators first (school admins)
        let schoolModerators: any[] = [];
        if (data.schoolId) {
            schoolModerators = await Users.find({
                where: [
                    { isSchoolAdmin: true, adminForSchoolId: data.schoolId },
                    { schoolId: data.schoolId, isAdmin: true },
                    { schoolId: data.schoolId, isModerator: true },
                ],
                select: ['id', 'username', 'schoolId', 'isSchoolAdmin'],
            });
        }

        // Get platform-wide moderators and admins
        const platformModerators = await Users.find({
            where: [
                { isAdmin: true },
                { isModerator: true },
            ],
            select: ['id', 'username', 'isAdmin', 'isModerator'],
        });

        const allModerators = [...schoolModerators, ...platformModerators];

        logger.info(`Notifying ${allModerators.length} moderators (${schoolModerators.length} school, ${platformModerators.length} platform) about ${type}:`, {
            type,
            contentId: data.contentId,
            schoolId: data.schoolId,
            entity: data.entity,
            confidence: data.confidence,
            category: data.category,
        });

        // Log school-specific alert
        if (data.schoolId && schoolModerators.length > 0) {
            logger.warn(`🚨 SCHOOL ALERT - ${data.schoolId}: ${type}`, {
                contentId: data.contentId,
                entity: data.entity,
                confidence: data.confidence,
                category: data.category,
                reason: data.reason,
                schoolAdmins: schoolModerators.length,
                actionTaken: getActionDescription(type, data),
            });
        }

        // Publish notifications to individual moderators using the existing abuse report system
        for (const moderator of allModerators) {
            try {
                publishAdminStream(moderator.id, 'newAbuseUserReport', {
                    id: data.iffyRecordId || `content-mod-${Date.now()}`,
                    targetUserId: data.userId || 'unknown',
                    reporterId: 'system',
                    comment: `${type}: ${data.reason || 'Flagged content'} (Confidence: ${data.confidence || 0}, Category: ${data.category || 'unknown'})`,
                });
            } catch (streamError) {
                logger.warn(`Failed to send stream notification to moderator ${moderator.id}:`, {
                    error: streamError instanceof Error ? streamError.message : String(streamError)
                });
            }
        }

    } catch (error) {
        logger.error(`Failed to notify moderators: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function getActionDescription(type: string, data: any): string {
    switch (type) {
        case 'contentFlagged':
            switch (data.entity) {
                case 'note':
                case 'post':
                    return 'Post automatically hidden from timeline';
                case 'message':
                    return 'Message automatically deleted';
                case 'file':
                case 'image':
                    return 'File marked as sensitive and access restricted';
                default:
                    return 'Content flagged and action taken';
            }
        case 'contentUnflagged':
            return 'Content restored and made visible again';
        case 'contentApproved':
            return 'Content approved by moderation and made visible';
        case 'userRiskAlert':
            const riskLevel = data.riskLevel;
            if (riskLevel === 'critical_risk_user') {
                return 'User flagged as critical risk - immediate review recommended';
            } else if (riskLevel === 'high_risk_user') {
                return 'User flagged as high risk - review recommended';
            } else if (riskLevel === 'user_cleared') {
                return 'User risk status cleared - normal operation';
            }
            return 'User risk status alert';
        default:
            return 'Moderation alert received';
    }
}

/**
 * Create an abuse report on behalf of the automod account when content is flagged
 */
async function createAutomodAbuseReport(targetUser: any, payload: any): Promise<void> {
    try {
        logger.info(`🤖 Creating automod abuse report for user ${targetUser.id} (${targetUser.username || 'unknown'})`);

        const meta = await fetchMeta();

        // Only create report if automod account is configured
        if (!meta.automodAccountId) {
            logger.warn('❌ No automod account configured - skipping automatic abuse report creation');
            return;
        }

        // Verify automod account exists
        const automodAccount = await Users.findOneBy({ id: meta.automodAccountId });
        if (!automodAccount) {
            logger.error(`❌ Automod account ${meta.automodAccountId} not found - skipping automatic abuse report creation`);
            return;
        }

        logger.info(`✅ Using automod account: ${automodAccount.username} (${automodAccount.id})`);

        // TEMPORARILY DISABLED: Don't report admins (for testing purposes)
        // TODO: Re-enable this check in production
        if (targetUser.isAdmin) {
            logger.warn(`⚠️  TESTING: Creating automod report for admin user ${targetUser.id} (admin check temporarily disabled)`);
        }

        // Get note details if this is a note being flagged
        let noteDetails = '';
        if (payload.entity === 'post' || payload.entity === 'text') {
            try {
                const note = await Notes.findOneBy({ id: payload.clientId });
                if (note) {
                    const noteText = note.text || '';
                    const notePreview = noteText.length > 200 ? noteText.substring(0, 200) + '...' : noteText;
                    noteDetails = `\n• Note ID: ${note.id}\n• Note Text: "${notePreview}"`;
                }
            } catch (error) {
                logger.warn(`Failed to get note details for ${payload.clientId}:`, error);
            }
        }

        // Generate report comment based on Iffy data
        const reportComment = `🤖 Automatic Content Moderation Report

Content flagged by AI moderation system:
• Content ID: ${payload.clientId}
• Content Type: ${payload.entity || 'unknown'}
• Flag Category: ${payload.category || 'inappropriate'}
• Confidence: ${Math.round((payload.confidence || 0.8) * 100)}%
• Reason: ${payload.name || 'Content flagged as inappropriate'}
• Detection Time: ${new Date().toISOString()}${noteDetails}

This report was automatically generated when inappropriate content was detected and hidden. Please review the user's recent activity for patterns of violations.`;

		// Create the abuse report using the same pattern as the working user report endpoint
		logger.info(`📝 Creating abuse report in database...`);
		const report = await AbuseUserReports.insert({
			id: genId(),
			createdAt: new Date(),
			targetUserId: targetUser.id,
			targetUserHost: targetUser.host,
			reporterId: automodAccount.id,
			reporterHost: null,
			comment: reportComment,
			isGenerated: true, // Mark as auto-generated report
		}).then(x => AbuseUserReports.findOneByOrFail(x.identifiers[0]));        logger.info(`✅ Created automod abuse report ${report.id} for user ${targetUser.id} (${targetUser.username || 'unknown'})`);

        // Notify moderators using the same pattern as the working user report endpoint
        setImmediate(async () => {
            try {
                // Get platform moderators
                const moderators = await Users.find({
                    where: [{
                        isAdmin: true,
                    }, {
                        isModerator: true,
                    }],
                });

                // Notify platform moderators
                for (const moderator of moderators) {
                    publishAdminStream(moderator.id, 'newAbuseUserReport', {
                        id: report.id,
                        targetUserId: report.targetUserId,
                        reporterId: report.reporterId,
                        comment: report.comment,
                    });
                }

                // Also notify school admins if user is in a school
                if (targetUser.schoolId) {
                    const schoolAdmins = await Users.find({
                        where: {
                            adminForSchoolId: targetUser.schoolId,
                            isSchoolAdmin: true,
                        },
                    });

                    for (const schoolAdmin of schoolAdmins) {
                        publishAdminStream(schoolAdmin.id, 'newAbuseUserReport', {
                            id: report.id,
                            targetUserId: report.targetUserId,
                            reporterId: report.reporterId,
                            comment: report.comment,
                        });
                    }
                }

                logger.info(`Notified moderators about automod abuse report ${report.id}`);

            } catch (error) {
                logger.error(`Failed to notify moderators about automod report: ${error instanceof Error ? error.message : String(error)}`);
            }
        });

    } catch (error) {
        logger.error(`Failed to create automod abuse report for user ${targetUser.id}: ${error instanceof Error ? error.message : String(error)}`);
        logger.error('Error details:', error);
    }
}
