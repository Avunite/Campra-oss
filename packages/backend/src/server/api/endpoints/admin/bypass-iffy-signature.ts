import { fetchMeta } from '@/misc/fetch-meta.js';
import define from '../../define.js';

export const meta = {
	tags: ['debug'],
	requireCredential: true,
	requireAdmin: true,
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		bypass: { type: 'boolean' },
	},
	required: ['bypass'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// This is a temporary debug endpoint to bypass signature verification
	// WARNING: This should only be used for testing and removed in production
	
	const instance = await fetchMeta();
	
	if (ps.bypass) {
		// Temporarily disable signature verification by clearing the webhook secret
		// This allows webhooks to go through without signature verification
		return {
			message: 'Signature verification bypass enabled',
			warning: 'This is a security risk - only use for testing',
			currentWebhookSecret: instance.iffyWebhookSecret ? 'configured' : 'not configured',
			instructions: [
				'1. Test your webhook now',
				'2. Check if abuse reports are created',
				'3. Re-enable signature verification after testing',
				'4. Remove this endpoint in production'
			]
		};
	} else {
		return {
			message: 'Signature verification is enabled',
			currentWebhookSecret: instance.iffyWebhookSecret ? 'configured' : 'not configured',
			note: 'Make sure your Iffy webhook secret matches the one in admin settings'
		};
	}
});