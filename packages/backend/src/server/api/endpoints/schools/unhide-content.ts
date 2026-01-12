import define from '../../define.js';
import { Notes, ContentFlags, Users } from '@/models/index.js';
import { ApiError } from '../../error.js';
import Logger from '@/services/logger.js';

const logger = new Logger('unhide-content');

export const meta = {
	tags: ['schools'],
	requireCredential: true,
	requireSchoolAdmin: true,
	
	description: 'Unhide content that was flagged by moderation system (school admin only)',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			success: {
				type: 'boolean',
			},
			message: {
				type: 'string',
				optional: true,
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		contentId: { 
			type: 'string', 
			format: 'campra:id',
			description: 'ID of the content to unhide'
		},
		contentType: {
			type: 'string',
			enum: ['note', 'profile-bio', 'profile-name'],
			description: 'Type of content to unhide'
		},
		reason: {
			type: 'string',
			nullable: true,
			description: 'Reason for unhiding the content'
		},
	},
	required: ['contentId', 'contentType'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Check if user is school admin
	if (!user.isSchoolAdmin || !user.adminForSchoolId) {
		throw new ApiError({
			message: 'Access denied: School admin access required',
			code: 'ACCESS_DENIED',
			id: 'unhide-content-access-denied',
		});
	}

	const schoolId = user.adminForSchoolId;

	try {
		// Handle different content types
		switch (ps.contentType) {
			case 'note': {
				// Find the note and verify it belongs to a user in this school
				const note = await Notes.findOne({
					where: { id: ps.contentId },
					relations: ['user'],
				});

				if (!note) {
					throw new ApiError({
						message: 'Note not found',
						code: 'NOTE_NOT_FOUND',
						id: 'unhide-note-not-found',
					});
				}

				// Check if the note's author is from the admin's school
				if (note.user.schoolId !== schoolId) {
					throw new ApiError({
						message: 'Permission denied: Note author is not from your school',
						code: 'PERMISSION_DENIED',
						id: 'unhide-note-not-your-school',
					});
				}

				// Check if this note is currently hidden due to flagging
				const isCurrentlyHidden = note.visibility === 'specified' && 
					(!note.visibleUserIds || note.visibleUserIds.length === 0);

				if (!isCurrentlyHidden) {
					return {
						success: false,
						message: 'Note is not currently hidden by moderation system',
					};
				}

				// Restore the note to public visibility
				// Check if we have original visibility info from iffy scan
				let originalVisibility = 'public';
				let originalVisibleUserIds: string[] = [];

				if (note.iffyScanResult) {
					const scanResult = note.iffyScanResult as any;
					if (scanResult.originalVisibility) {
						originalVisibility = scanResult.originalVisibility;
						originalVisibleUserIds = scanResult.originalVisibleUserIds || [];
					}
				}

				await Notes.update(ps.contentId, {
					visibility: originalVisibility as any,
					visibleUserIds: originalVisibleUserIds,
					iffyScanResult: note.iffyScanResult ? {
						...(note.iffyScanResult as any),
						manuallyApproved: true,
						approvedBySchoolAdmin: user.id,
						approvedAt: new Date(),
						approvalReason: ps.reason || 'Manually approved by school admin',
					} : {
						manuallyApproved: true,
						approvedBySchoolAdmin: user.id,
						approvedAt: new Date(),
						approvalReason: ps.reason || 'Manually approved by school admin',
					},
				});

				// Update any related content flags
				try {
					await ContentFlags.update(
						{ contentId: ps.contentId, contentType: 'note' },
						{ 
							status: 'approved',
							reviewedAt: new Date(),
							reviewedByUserId: user.id,
							action: 'restore',
						}
					);
				} catch (error) {
					logger.warn(`Failed to update content flags for note ${ps.contentId}:`, { error: error instanceof Error ? error.message : String(error) });
				}

				logger.info(`School admin ${user.username} unhid note ${ps.contentId} from school ${schoolId}`);

				return {
					success: true,
					message: 'Note successfully restored and made visible',
				};
			}

			case 'profile-bio':
			case 'profile-name': {
				// For profile content, we need to handle it differently
				// This would typically involve clearing flags and allowing the content to be visible again
				
				// Update any related content flags
				try {
					const flagsUpdated = await ContentFlags.update(
						{ contentId: ps.contentId, contentType: ps.contentType },
						{ 
							status: 'approved',
							reviewedAt: new Date(),
							reviewedByUserId: user.id,
							action: 'restore',
						}
					);

					if (flagsUpdated.affected === 0) {
						return {
							success: false,
							message: 'No flagged content found to restore',
						};
					}

					logger.info(`School admin ${user.username} approved ${ps.contentType} ${ps.contentId} from school ${schoolId}`);

					return {
						success: true,
						message: `${ps.contentType} content successfully approved`,
					};
				} catch (error) {
					logger.error(`Failed to approve ${ps.contentType} content:`, { error: error instanceof Error ? error.message : String(error) });
					throw new ApiError({
						message: 'Failed to approve content',
						code: 'APPROVAL_FAILED',
						id: 'unhide-approval-failed',
					});
				}
			}

			default:
				throw new ApiError({
					message: 'Unsupported content type',
					code: 'UNSUPPORTED_CONTENT_TYPE',
					id: 'unhide-unsupported-type',
				});
		}

	} catch (error) {
		if (error instanceof ApiError) {
			throw error;
		}

		logger.error(`Failed to unhide content ${ps.contentId}:`, { error: error instanceof Error ? error.message : String(error) });
		
		throw new ApiError({
			message: 'Internal server error while unhiding content',
			code: 'INTERNAL_ERROR',
			id: 'unhide-internal-error',
		});
	}
});
