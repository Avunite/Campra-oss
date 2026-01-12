import { fetchMeta } from '@/misc/fetch-meta.js';
import { getS3 } from './s3.js';

/**
 * Generate a signed URL for private S3 objects
 * @param key S3 object key
 * @param expires Expiration time in seconds (default: 1 hour)
 * @returns Signed URL
 */
export async function generateSignedUrl(key: string, expires: number = 3600): Promise<string> {
    const meta = await fetchMeta();

    if (!meta.useObjectStorage) {
        throw new Error('Object storage is not enabled');
    }

    const s3 = getS3(meta);

    const params = {
        Bucket: meta.objectStorageBucket!,
        Key: key,
        Expires: expires,
    };

    return s3.getSignedUrl('getObject', params);
}

/**
 * Generate signed URLs for a drive file (original, thumbnail, webpublic)
 */
export async function generateFileSignedUrls(file: {
    accessKey: string | null;
    thumbnailAccessKey: string | null;
    webpublicAccessKey: string | null;
    storedInternal: boolean;
    url: string | null;
    thumbnailUrl: string | null;
    webpublicUrl: string | null;
}) {
    const meta = await fetchMeta();

    // If using internal storage, return original URLs (can't sign local files)
    if (file.storedInternal) {
        return {
            url: file.url,
            thumbnailUrl: file.thumbnailUrl,
            webpublicUrl: file.webpublicUrl,
        };
    }

    // For S3 objects, ALWAYS generate signed URLs for security
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
        urls.url = await generateSignedUrl(file.accessKey);
    }

    if (file.thumbnailAccessKey) {
        urls.thumbnailUrl = await generateSignedUrl(file.thumbnailAccessKey);
    }

    if (file.webpublicAccessKey) {
        urls.webpublicUrl = await generateSignedUrl(file.webpublicAccessKey);
    }

    return urls;
}