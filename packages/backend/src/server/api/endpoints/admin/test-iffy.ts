import { fetchMeta } from '@/misc/fetch-meta.js';
import { contentAutoModerator } from '@/services/content-auto-moderator.js';
import define from '../../define.js';

export const meta = {
	tags: ['debug'],
	requireCredential: true,
	requireAdmin: true,
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		content: { type: 'string' },
	},
	required: ['content'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const instance = await fetchMeta();
	
	const config = {
		enableContentModeration: instance.enableContentModeration,
		iffyApiKey: instance.iffyApiKey ? '***configured***' : 'not configured',
		iffyApiUrl: instance.iffyApiUrl,
		iffyWebhookSecret: instance.iffyWebhookSecret ? '***configured***' : 'not configured',
		iffyConfidenceThreshold: instance.iffyConfidenceThreshold,
		autoHideInappropriateContent: instance.autoHideInappropriateContent,
		isModeratorAvailable: contentAutoModerator.isAvailable(),
	};

	// Test content moderation
	let moderationResult = null;
	try {
		moderationResult = await contentAutoModerator.moderatePost('test-post-id', ps.content, user.id);
	} catch (error) {
		moderationResult = { error: error instanceof Error ? error.message : String(error) };
	}

	return {
		config,
		moderationResult,
		message: 'Iffy configuration test completed',
	};
});
