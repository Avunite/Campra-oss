import { generateSignedUrl } from '@/services/drive/signed-url.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import define from '../../define.js';
import { ApiError } from '../../error.js';

export const meta = {
    tags: ['drive'],
    requireCredential: false,
    description: 'Serve files with proper S3 URL structure: baseUrl/prefix/filename?key=...',
    res: {
        type: 'object',
        optional: false, nullable: false,
    },
    errors: {
        noSuchFile: {
            message: 'No such file.',
            code: 'NO_SUCH_FILE',
            id: '067bc436-2718-4795-b0fb-ecbe43949e31',
        },
    },
} as const;

export const paramDef = {
    type: 'object',
    properties: {
        key: { type: 'string' },
    },
    required: ['key'],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps, user, token, ctx) => {
    try {
        const meta = await fetchMeta();

        // Construct the proper S3 URL: baseUrl/prefix/filename
        const baseUrl = meta.objectStorageBaseUrl
            || `${meta.objectStorageUseSSL ? 'https' : 'http'}://${meta.objectStorageEndpoint}${meta.objectStoragePort ? `:${meta.objectStoragePort}` : ''}/${meta.objectStorageBucket}`;

        // The key already includes the prefix (e.g., "up/thumbnail-abc123.webp")
        const fileUrl = `${baseUrl}/${ps.key}`;

        // Generate signed URL parameters
        const signedUrl = await generateSignedUrl(ps.key, 3600); // 1 hour expiration

        // Extract the query parameters from the signed URL
        const signedUrlObj = new URL(signedUrl);
        const queryParams = signedUrlObj.searchParams;

        // Construct the final URL with the proper base URL and signed parameters
        const finalUrl = new URL(fileUrl);
        queryParams.forEach((value, key) => {
            finalUrl.searchParams.set(key, value);
        });

        // Redirect to the properly constructed signed URL
        ctx.redirect(finalUrl.toString());
        ctx.set('Cache-Control', 'max-age=300'); // 5 minutes cache for redirect

        return {};
    } catch (error) {
        throw new ApiError(meta.errors.noSuchFile);
    }
});