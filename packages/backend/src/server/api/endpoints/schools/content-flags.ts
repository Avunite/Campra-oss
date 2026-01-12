import define from '../../define.js';
import { ContentFlags } from '@/models/index.js';

export const meta = {
	tags: ['schools'],
	requireCredential: true,
	
	description: 'Get flagged content for school moderation (school admin only)',

	res: {
		type: 'array',
		optional: false,
		nullable: false,
		items: {
			type: 'object',
			optional: false,
			nullable: false,
			properties: {
				id: {
					type: 'string',
					optional: false,
					nullable: false,
				},
				contentId: {
					type: 'string',
					optional: false,
					nullable: false,
				},
				contentType: {
					type: 'string',
					optional: false,
					nullable: false,
				},
				category: {
					type: 'string',
					optional: false,
					nullable: false,
				},
				confidence: {
					type: 'number',
					optional: false,
					nullable: false,
				},
				reason: {
					type: 'string',
					optional: false,
					nullable: false,
				},
				status: {
					type: 'string',
					optional: false,
					nullable: false,
				},
				createdAt: {
					type: 'string',
					optional: false,
					nullable: false,
				},
				iffyScanResult: {
					type: 'object',
					optional: true,
					nullable: true,
				},
				iffyScanUrl: {
					type: 'string',
					optional: true,
					nullable: true,
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		status: {
			type: 'string',
			enum: ['pending', 'approved', 'removed', 'resolved'],
			default: 'pending',
		},
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
		offset: { type: 'integer', minimum: 0, default: 0 },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Check if user is school admin
	if (!user.isSchoolAdmin || !user.adminForSchoolId) {
		throw new Error('Access denied: School admin access required');
	}

	const schoolId = user.adminForSchoolId;

	// Get flagged content for this school by finding notes from users in this school
	// Since ContentFlag doesn't have schoolId, we need to join with users to filter by school
	const flags = await ContentFlags.createQueryBuilder('flag')
		.select([
			'flag.id',
			'flag.contentType',
			'flag.contentId',
			'flag.flagType',
			'flag.confidence',
			'flag.metadata',
			'flag.status',
			'flag.createdAt',
			'note.iffyScanResult',
			'note.iffyScanUrl',
		])
		.innerJoin('note', 'note', 'note.id = flag.contentId AND flag.contentType = :contentType', { contentType: 'note' })
		.innerJoin('user', 'user', 'user.id = note.userId')
		.where('user.schoolId = :schoolId', { schoolId })
		.andWhere('flag.status = :status', { status: ps.status })
		.orderBy('flag.createdAt', 'DESC')
		.skip(ps.offset)
		.take(ps.limit)
		.getRawMany();

	return flags.map((flag: any) => ({
		id: flag.flag_id,
		contentId: flag.flag_contentId,
		contentType: flag.flag_contentType,
		category: flag.flag_flagType, // Using flagType instead of category
		confidence: flag.flag_confidence || 0,
		reason: flag.flag_metadata?.reason || 'Content flagged by moderation system',
		status: flag.flag_status,
		createdAt: flag.flag_createdAt.toISOString(),
		iffyScanResult: flag.note_iffyScanResult,
		iffyScanUrl: flag.note_iffyScanUrl,
	}));
});
