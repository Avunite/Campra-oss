import define from '../../../define.js';
import { Emojis } from '@/models/index.js';
import { In } from 'typeorm';
import { ApiError } from '../../../error.js';
import { db } from '@/db/postgre.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			success: {
				type: 'boolean',
				optional: false, nullable: false,
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		ids: { type: 'array', items: {
			type: 'string', format: 'campra:id',
		} },
		category: {
			type: 'string',
			nullable: true,
			description: 'Use `null` to reset the category.',
		},
	},
	required: ['ids'],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps) => {
	await Emojis.update({
		id: In(ps.ids),
	}, {
		updatedAt: new Date(),
		category: ps.category,
	});

	await db.queryResultCache!.remove(['meta_emojis']);
	
	return { success: true };
});
