import { db } from '@/db/postgre.js';
import { DriveFile } from '@/models/entities/drive-file.js';
import { User } from '@/models/entities/user.js';
import { toPuny } from '@/misc/convert-host.js';
import { awaitAll, Promiseable } from '@/prelude/await-all.js';
import { Packed } from '@/misc/schema.js';
import config from '@/config/index.js';
import { query, appendQuery } from '@/prelude/url.js';
import { Meta } from '@/models/entities/meta.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { Users, DriveFolders } from '../index.js';
import { deepClone } from '@/misc/clone.js';


type PackOptions = {
	detail?: boolean,
	self?: boolean,
	withUser?: boolean,
};

export const DriveFileRepository = db.getRepository(DriveFile).extend({
	validateFileName(name: string): boolean {
		return (
			(name.trim().length > 0) &&
			(name.length <= 200) &&
			(name.indexOf('\\') === -1) &&
			(name.indexOf('/') === -1) &&
			(name.indexOf('..') === -1)
		);
	},

	getPublicProperties(file: DriveFile): DriveFile['properties'] {
		if (file.properties.orientation != null) {
			const properties = deepClone(file.properties);
			if (file.properties.orientation >= 5) {
				[properties.width, properties.height] = [properties.height, properties.width];
			}
			properties.orientation = undefined;
			return properties;
		}

		return file.properties;
	},

	getPublicUrl(file: DriveFile, thumbnail = false): string | null {
		// リモートかつメディアプロキシ
		if (file.uri != null && file.userHost != null && config.mediaProxy != null) {
			return appendQuery(config.mediaProxy, query({
				url: file.uri,
				thumbnail: thumbnail ? '1' : undefined,
			}));
		}

		// リモートかつ期限切れはローカルプロキシを試みる
		if (file.uri != null && file.isLink && config.proxyRemoteFiles) {
			const key = thumbnail ? file.thumbnailAccessKey : file.webpublicAccessKey;

			if (key && !key.match('/')) {	// 古いものはここにオブジェクトストレージキーが入ってるので除外
				return `${config.url}/files/${key}`;
			}
		}

		const isImage = file.type && ['image/png', 'image/apng', 'image/gif', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/avif'].includes(file.type);

		return thumbnail ? (file.thumbnailUrl || (isImage ? (file.webpublicUrl || file.url) : null)) : (file.webpublicUrl || file.url);
	},

	async getSecureUrl(file: DriveFile, thumbnail = false): Promise<string | null> {
		const meta = await fetchMeta();

		// If using internal storage, use regular public URL (can't sign local files)
		if (file.storedInternal) {
			return this.getPublicUrl(file, thumbnail);
		}

		// For S3 objects, generate proper signed URLs with S3 base URL structure
		if (meta.useObjectStorage && !file.storedInternal) {
			try {
				// Get the appropriate access key
				let accessKey: string | null = null;

				if (thumbnail) {
					accessKey = file.thumbnailAccessKey || file.webpublicAccessKey || file.accessKey;
				} else {
					accessKey = file.webpublicAccessKey || file.accessKey;
				}

				if (accessKey) {
					// Construct the proper S3 URL: baseUrl/prefix/filename
					const baseUrl = meta.objectStorageBaseUrl
						|| `${meta.objectStorageUseSSL ? 'https' : 'http'}://${meta.objectStorageEndpoint}${meta.objectStoragePort ? `:${meta.objectStoragePort}` : ''}/${meta.objectStorageBucket}`;

					// Generate signed URL using the access key
					const { generateSignedUrl } = await import('@/services/drive/signed-url.js');
					const signedUrl = await generateSignedUrl(accessKey, 3600); // 1 hour expiration

					// Extract the query parameters from the signed URL
					const signedUrlObj = new URL(signedUrl);
					const queryParams = signedUrlObj.searchParams;

					// Construct the final URL with the proper base URL and signed parameters
					const fileUrl = `${baseUrl}/${accessKey}`;
					const finalUrl = new URL(fileUrl);
					queryParams.forEach((value, key) => {
						finalUrl.searchParams.set(key, value);
					});

					return finalUrl.toString();
				}
			} catch (error) {
				// Log error for debugging - would be handled by application logging system
				// Fallback to regular URL
				return this.getPublicUrl(file, thumbnail);
			}
		}

		return this.getPublicUrl(file, thumbnail);
	},

	async calcDriveUsageOf(user: User['id'] | { id: User['id'] }): Promise<number> {
		const id = typeof user === 'object' ? user.id : user;

		const { sum } = await this
			.createQueryBuilder('file')
			.where('file.userId = :id', { id: id })
			.andWhere('file.isLink = FALSE')
			.select('SUM(file.size)', 'sum')
			.getRawOne();

		return parseInt(sum, 10) || 0;
	},

	async calcDriveUsageOfHost(host: string): Promise<number> {
		const { sum } = await this
			.createQueryBuilder('file')
			.where('file.userHost = :host', { host: toPuny(host) })
			.andWhere('file.isLink = FALSE')
			.select('SUM(file.size)', 'sum')
			.getRawOne();

		return parseInt(sum, 10) || 0;
	},

	async calcDriveUsageOfLocal(): Promise<number> {
		const { sum } = await this
			.createQueryBuilder('file')
			.where('file.userHost IS NULL')
			.andWhere('file.isLink = FALSE')
			.select('SUM(file.size)', 'sum')
			.getRawOne();

		return parseInt(sum, 10) || 0;
	},

	async calcDriveUsageOfRemote(): Promise<number> {
		const { sum } = await this
			.createQueryBuilder('file')
			.where('file.userHost IS NOT NULL')
			.andWhere('file.isLink = FALSE')
			.select('SUM(file.size)', 'sum')
			.getRawOne();

		return parseInt(sum, 10) || 0;
	},

	async pack(
		src: DriveFile['id'] | DriveFile,
		options?: PackOptions,
	): Promise<Packed<'DriveFile'>> {
		const opts = Object.assign({
			detail: false,
			self: false,
		}, options);

		const file = typeof src === 'object' ? src : await this.findOneByOrFail({ id: src });

		return await awaitAll<Packed<'DriveFile'>>({
			id: file.id,
			createdAt: file.createdAt.toISOString(),
			name: file.name,
			type: file.type,
			md5: file.md5,
			size: file.size,
			isSensitive: file.isSensitive,
			blurhash: file.blurhash,
			properties: opts.self ? file.properties : this.getPublicProperties(file),
			url: await this.getSecureUrl(file, false),
			thumbnailUrl: await this.getSecureUrl(file, true),
			comment: file.comment,
			folderId: file.folderId,
			folder: opts.detail && file.folderId ? DriveFolders.pack(file.folderId, {
				detail: true,
			}) : null,
			userId: opts.withUser ? file.userId : null,
			user: (opts.withUser && file.userId) ? Users.pack(file.userId) : null,
		});
	},

	async packNullable(
		src: DriveFile['id'] | DriveFile,
		options?: PackOptions,
	): Promise<Packed<'DriveFile'> | null> {
		const opts = Object.assign({
			detail: false,
			self: false,
		}, options);

		const file = typeof src === 'object' ? src : await this.findOneBy({ id: src });
		if (file == null) return null;

		return await awaitAll<Packed<'DriveFile'>>({
			id: file.id,
			createdAt: file.createdAt.toISOString(),
			name: file.name,
			type: file.type,
			md5: file.md5,
			size: file.size,
			isSensitive: file.isSensitive,
			blurhash: file.blurhash,
			properties: opts.self ? file.properties : this.getPublicProperties(file),
			url: await this.getSecureUrl(file, false),
			thumbnailUrl: await this.getSecureUrl(file, true),
			comment: file.comment,
			folderId: file.folderId,
			folder: opts.detail && file.folderId ? DriveFolders.pack(file.folderId, {
				detail: true,
			}) : null,
			userId: opts.withUser ? file.userId : null,
			user: (opts.withUser && file.userId) ? Users.pack(file.userId) : null,
		});
	},

	async packMany(
		files: (DriveFile['id'] | DriveFile)[],
		options?: PackOptions,
	): Promise<Packed<'DriveFile'>[]> {
		const items = await Promise.all(files.map(f => this.packNullable(f, options)));
		return items.filter((x): x is Packed<'DriveFile'> => x != null);
	},
});
