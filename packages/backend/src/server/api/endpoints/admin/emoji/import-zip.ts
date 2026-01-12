import define from '../../../define.js';
import { createImportCustomEmojisJob } from '@/queue/index.js';
import ms from 'ms';

export const meta = {
	secure: true,
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
		fileId: { type: 'string', format: 'campra:id' },
	},
	required: ['fileId'],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps, user) => {
	createImportCustomEmojisJob(user, ps.fileId);
	return { success: true };
});
