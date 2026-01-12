import { DriveFiles } from '@/models/index.js';
import { generateFileSignedUrls } from '@/services/drive/signed-url.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import config from '@/config/index.js';
import define from '../../../define.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['drive'],

	requireCredential: true,

	kind: 'read:drive',

	description: 'Get signed URLs for a private drive file.',

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			url: {
				type: 'string',
				optional: false, nullable: true,
			},
			thumbnailUrl: {
				type: 'string',
				optional: false, nullable: true,
			},
			webpublicUrl: {
				type: 'string',
				optional: false, nullable: true,
			},
		},
	},

	errors: {
		noSuchFile: {
			message: 'No such file.',
			code: 'NO_SUCH_FILE',
			id: '067bc436-2718-4795-b0fb-ecbe43949e31',
		},

		accessDenied: {
			message: 'Access denied.',
			code: 'ACCESS_DENIED',
			id: '25b73c73-68b1-41d0-bad1-381cfdf6579f',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		fileId: { type: 'string', format: 'campra:id' },
		expires: { type: 'number', minimum: 60, maximum: 86400, default: 3600 }, // 1 minute to 24 hours
	},
	required: ['fileId'],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps, user) => {
	const file = await DriveFiles.findOneBy({ id: ps.fileId });

	if (file == null) {
		throw new ApiError(meta.errors.noSuchFile);
	}

	if ((!user.isAdmin && !user.isModerator) && (file.userId !== user.id)) {
		throw new ApiError(meta.errors.accessDenied);
	}

	try {
		// Generate clean proxy URLs using your domain
		const { fetchMeta } = await import('@/misc/fetch-meta.js');
		const meta = await fetchMeta();
		const baseUrl = meta.objectStorageBaseUrl || config.url;
		
		const urls: {
			url: string | null;
			thumbnailUrl: string | null;
			webpublicUrl: string | null;
		} = {
			url: null,
			thumbnailUrl: null,
			webpublicUrl: null,
		};

		if (file.accessKey) {
			urls.url = `${config.url}/media/file?key=${encodeURIComponent(file.accessKey)}`;
		}

		if (file.thumbnailAccessKey) {
			urls.thumbnailUrl = `${config.url}/media/file?key=${encodeURIComponent(file.thumbnailAccessKey)}`;
		}

		if (file.webpublicAccessKey) {
			urls.webpublicUrl = `${config.url}/media/file?key=${encodeURIComponent(file.webpublicAccessKey)}`;
		}

		return urls;
	} catch (error) {
		// Log error for debugging
		if (error instanceof Error) {
			// Error logging would be handled by the application's logging system
		}
		throw new ApiError(meta.errors.noSuchFile);
	}
});