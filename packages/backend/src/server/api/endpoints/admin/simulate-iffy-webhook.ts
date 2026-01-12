import define from '../../define.js';
import { genId } from '@/misc/gen-id.js';

export const meta = {
	tags: ['debug'],
	requireCredential: true,
	requireAdmin: true,
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		contentId: { type: 'string' },
		userId: { type: 'string' },
		action: { type: 'string', enum: ['flagged', 'unflagged'], default: 'flagged' },
	},
	required: ['contentId', 'userId'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Simulate an Iffy webhook for testing purposes
	const webhookData = {
		id: genId(),
		event: ps.action === 'flagged' ? 'record.flagged' : 'record.unflagged',
		payload: {
			id: genId(),
			clientId: ps.contentId,
			clientUrl: `https://example.com/notes/${ps.contentId}`,
			name: 'Test inappropriate content',
			entity: 'post',
			metadata: {},
			status: ps.action === 'flagged' ? 'Flagged' : 'Compliant',
			statusUpdatedAt: new Date().toISOString(),
			statusUpdatedVia: 'Manual',
			user: {
				id: genId(),
				clientId: ps.userId,
				clientUrl: `https://example.com/users/${ps.userId}`,
				protected: false,
				metadata: {},
				status: 'Compliant',
				statusUpdatedAt: new Date().toISOString(),
				statusUpdatedVia: 'Manual',
			}
		},
		timestamp: Date.now().toString()
	};

	// Call our webhook endpoint internally for testing
	const endpoint = await import('../iffy/webhook.js');
	
	try {
		const result = await endpoint.default(
			{
				id: webhookData.id,
				event: webhookData.event,
				payload: webhookData.payload,
				timestamp: webhookData.timestamp,
				body: JSON.stringify(webhookData),
				signature: null,
			},
			null
		);

		return {
			success: true,
			message: `Simulated ${ps.action} webhook for content ${ps.contentId}`,
			webhookData,
			result,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
			webhookData,
		};
	}
});
