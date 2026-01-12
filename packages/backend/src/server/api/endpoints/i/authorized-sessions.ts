import define from '../../define.js';
import { AuthSessions, Apps } from '@/models/index.js';

export const meta = {
	tags: ['account', 'auth'],

	requireCredential: true,
	
	secure: true,

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			properties: {
				id: {
					type: 'string',
					optional: false, nullable: false,
				},
				app: {
					type: 'object',
					optional: false, nullable: false,
					ref: 'App',
				},
				token: {
					type: 'string',
					optional: false, nullable: false,
				},
				createdAt: {
					type: 'string',
					optional: false, nullable: false,
					format: 'date-time',
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: 'string' },
		untilId: { type: 'string' },
	},
	required: [],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps, user) => {
	const query = {
		userId: user.id,
	};

	// Pagination
	const pagination = {
		...ps.sinceId ? { id: { gt: ps.sinceId } } : {},
		...ps.untilId ? { id: { lt: ps.untilId } } : {},
	};

	// Get auth sessions
	const sessions = await AuthSessions.find({
		where: {
			...query,
			...pagination,
		},
		take: ps.limit,
		order: { createdAt: 'DESC' },
	});

	return await Promise.all(sessions.map(session => AuthSessions.pack(session, user)));
});
