import { db } from '@/db/postgre.js';
import { Emoji } from '@/models/entities/emoji.js';
import { Packed } from '@/misc/schema.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { generateSignedUrl } from '@/services/drive/signed-url.js';

export const EmojiRepository = db.getRepository(Emoji).extend({
	async pack(
		src: Emoji['id'] | Emoji,
	): Promise<Packed<'Emoji'>> {
		const emoji = typeof src === 'object' ? src : await this.findOneByOrFail({ id: src });

		// Regenerate URL with fresh signatures for object storage
		let url = emoji.publicUrl || emoji.originalUrl;
		
		const meta = await fetchMeta();
		if (meta.useObjectStorage && url) {
			try {
				// Extract the S3 object key from the stored URL
				const urlObj = new URL(url);
				const pathname = urlObj.pathname;
				
				// Remove query parameters to get the path
				// The path should be in format: /bucket/prefix/filename or /prefix/filename
				// We need to extract the key part (everything after the bucket)
				const baseUrl = meta.objectStorageBaseUrl
					|| `${meta.objectStorageUseSSL ? 'https' : 'http'}://${meta.objectStorageEndpoint}${meta.objectStoragePort ? `:${meta.objectStoragePort}` : ''}/${meta.objectStorageBucket}`;
				
				const baseUrlObj = new URL(baseUrl);
				
				// If the stored URL starts with our baseUrl, extract the key
				if (url.startsWith(baseUrl)) {
					const key = pathname.substring(baseUrlObj.pathname.length);
					if (key && key.length > 1) {
						// Generate fresh signed URL
						const signedUrl = await generateSignedUrl(key.startsWith('/') ? key.substring(1) : key, 3600);
						
						// Extract query parameters from signed URL
						const signedUrlObj = new URL(signedUrl);
						const queryParams = signedUrlObj.searchParams;
						
						// Construct final URL with configured baseUrl and fresh signatures
						const finalUrl = new URL(`${baseUrl}/${key.startsWith('/') ? key.substring(1) : key}`);
						queryParams.forEach((value, k) => {
							finalUrl.searchParams.set(k, value);
						});
						
						url = finalUrl.toString();
					}
				}
			} catch (error) {
				// If regeneration fails, fall back to stored URL
				// This handles cases where object storage is not properly configured
			}
		}

		return {
			id: emoji.id,
			aliases: emoji.aliases,
			name: emoji.name,
			category: emoji.category,
			host: emoji.host,
			// || emoji.originalUrl してるのは後方互換性のため
			url: url,
		};
	},

	packMany(
		emojis: any[],
	) {
		return Promise.all(emojis.map(x => this.pack(x)));
	},
});
