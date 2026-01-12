import define from '../../define.js';
import { Notes, Users, ContentFlags, AbuseUserReports } from '@/models/index.js';
import { SchoolService } from '@/services/school-service.js';
import Logger from '@/services/logger.js';

const logger = new Logger('moderation-stats');

export const meta = {
	tags: ['schools'],
	requireCredential: true,
	
	description: 'Get school moderation statistics (school admin only)',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			hiddenPosts: {
				type: 'integer',
				description: 'Number of hidden/removed posts from this school',
			},
			pendingReports: {
				type: 'integer',
				description: 'Number of pending moderation reports',
			},
			suspendedUsers: {
				type: 'integer',
				description: 'Number of suspended users from this school',
			},
			flaggedContent: {
				type: 'integer',
				description: 'Number of flagged content items',
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Check if user is school admin
	if (!user.isSchoolAdmin || !user.adminForSchoolId) {
		throw new Error('Access denied: School admin access required');
	}

	const schoolId = user.adminForSchoolId;

	// Get all user IDs from this school
	const schoolUsers = await Users.find({
		where: { schoolId: schoolId },
		select: ['id'],
	});
	const schoolUserIds = schoolUsers.map((u: any) => u.id);

	if (schoolUserIds.length === 0) {
		return {
			hiddenPosts: 0,
			pendingReports: 0,
			suspendedUsers: 0,
			flaggedContent: 0,
		};
	}

	// Count hidden posts from school users (notes with hidden visibility)
	let hiddenPosts = 0;
	if (schoolUserIds.length > 0) {
		// TODO: Find a way to count hidden posts
	}

	// Count suspended users from this school
	const suspendedUsers = await Users.count({
		where: {
			schoolId: schoolId,
			isSuspended: true,
		},
	});

	// Count flagged content (ContentFlags) from this school - these are AI/automated flags
	let flaggedContent = 0;
	try {
		if (schoolUserIds.length > 0) {
			// Count all content flags for content created by users in this school
			flaggedContent = await ContentFlags.createQueryBuilder('flag')
				.leftJoin('note', 'note', 'note.id = flag.contentId AND flag.contentType = :noteType', { noteType: 'note' })
				.leftJoin('user_profile', 'profile', 'profile.userId = flag.contentId AND flag.contentType IN (:...profileTypes)', { profileTypes: ['profile-bio', 'profile-name'] })
				.where('flag.status = :status', { status: 'pending' })
				.andWhere((qb: any) => {
					return qb.where('note.userId IN (:...userIds)', { userIds: schoolUserIds })
						.orWhere('profile.userId IN (:...userIds)', { userIds: schoolUserIds });
				})
				.getCount();
		}
	} catch (error: any) {
		// ContentFlag table might not exist yet, return 0
		logger.warn('ContentFlag table not available:', error.message);
	}

	// Count pending abuse reports (user reports) for this school - these are user-submitted reports
	// Exclude auto-generated reports to fix counter issues
	const pendingReports = await AbuseUserReports.createQueryBuilder('report')
		.leftJoin('report.targetUser', 'targetUser')
		.where('targetUser.schoolId = :schoolId', { schoolId })
		.andWhere('report.resolved = FALSE')
		.andWhere('(report.isGenerated = FALSE OR report.isGenerated IS NULL)') // Only count user reports, not AI-generated ones
		.getCount();

	return {
		hiddenPosts: hiddenPosts || 0,
		pendingReports: pendingReports || 0,
		suspendedUsers: suspendedUsers || 0,
		flaggedContent: flaggedContent || 0,
	};
});
