import define from '../../define.js';
import { AbuseUserReports } from '@/models/index.js';
import { makePaginationQuery } from '../../common/make-pagination-query.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			properties: {
				id: {
					type: 'string',
					nullable: false, optional: false,
					format: 'id',
					example: 'xxxxxxxxxx',
				},
				createdAt: {
					type: 'string',
					nullable: false, optional: false,
					format: 'date-time',
				},
				comment: {
					type: 'string',
					nullable: false, optional: false,
				},
				resolved: {
					type: 'boolean',
					nullable: false, optional: false,
					example: false,
				},
				reporterId: {
					type: 'string',
					nullable: false, optional: false,
					format: 'id',
				},
				targetUserId: {
					type: 'string',
					nullable: false, optional: false,
					format: 'id',
				},
				assigneeId: {
					type: 'string',
					nullable: true, optional: false,
					format: 'id',
				},
				reporter: {
					type: 'object',
					nullable: false, optional: false,
					ref: 'User',
				},
				targetUser: {
					type: 'object',
					nullable: false, optional: false,
					ref: 'User',
				},
				assignee: {
					type: 'object',
					nullable: true, optional: true,
					ref: 'User',
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: 'string', format: 'campra:id' },
		untilId: { type: 'string', format: 'campra:id' },
		state: { type: 'string', nullable: true, default: null },
		reporterOrigin: { type: 'string', enum: ['combined', 'local', 'remote'], default: "combined" },
		targetUserOrigin: { type: 'string', enum: ['combined', 'local', 'remote'], default: "combined" },
		forwarded: { type: 'boolean', default: false },
		schoolId: { type: 'string', format: 'campra:id', nullable: true },
	},
	required: [],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps, me) => {
	if (!me.isModerator && !me.isSchoolAdmin && !me.isAdmin) {
		throw new ApiError({ message: 'Permission denied.', code: 'PERMISSION_DENIED', id: 'b9737a88-b703-4425-9365-3848b89e324d' });
	}

	const query = makePaginationQuery(AbuseUserReports.createQueryBuilder('report'), ps.sinceId, ps.untilId);

	query.leftJoinAndSelect('report.targetUser', 'targetUser');
	query.leftJoinAndSelect('report.reporter', 'reporter');

	// School admins can only see reports for their school
	if (me.isSchoolAdmin && me.adminForSchoolId && !me.isAdmin) {
		query.andWhere('targetUser.schoolId = :schoolId', { schoolId: me.adminForSchoolId });
	} 
	// Super admins can filter by school if specified
	else if (ps.schoolId && me.isAdmin) {
		query.andWhere('targetUser.schoolId = :schoolId', { schoolId: ps.schoolId });
	}
	// Regular moderators see all reports (existing behavior)

	switch (ps.state) {
		case 'resolved': query.andWhere('report.resolved = TRUE'); break;
		case 'unresolved': query.andWhere('report.resolved = FALSE'); break;
	}

	switch (ps.reporterOrigin) {
		case 'local': query.andWhere('report.reporterHost IS NULL'); break;
		case 'remote': query.andWhere('report.reporterHost IS NOT NULL'); break;
	}

	switch (ps.targetUserOrigin) {
		case 'local': query.andWhere('report.targetUserHost IS NULL'); break;
		case 'remote': query.andWhere('report.targetUserHost IS NOT NULL'); break;
	}

	const reports = await query.take(ps.limit).getMany();

	return await AbuseUserReports.packMany(reports);
});
