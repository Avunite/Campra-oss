import { ContentFlags } from '@/models/index.js';
import { genId } from '@/misc/gen-id.js';
import define from '../../define.js';

export const meta = {
	tags: ['debug'],
	requireCredential: true,
	requireAdmin: true,
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		contentId: { type: 'string' },
		contentType: { type: 'string', default: 'note' },
		flagType: { type: 'string', default: 'inappropriate' },
		confidence: { type: 'number', default: 0.8 },
		status: { type: 'string', default: 'flagged' },
		source: { type: 'string', default: 'iffy' },
	},
	required: ['contentId'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	try {
		// Try to create a minimal content flag
		const contentFlag = await ContentFlags.insert({
			id: genId(),
			contentId: ps.contentId,
			contentType: ps.contentType,
			flagType: ps.flagType,
			confidence: ps.confidence,
			source: ps.source,
			status: ps.status,
			metadata: {
				automated: false,
				manuallyCreated: true,
				createdBy: user.id,
				createdAt: new Date().toISOString(),
				reason: 'Manual flag for testing',
			},
		});

		return {
			success: true,
			message: `Successfully created content flag for ${ps.contentId}`,
			contentFlag,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			params: ps,
		};
	}
});
