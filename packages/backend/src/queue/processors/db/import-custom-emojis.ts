import Bull from 'bull';
import * as fs from 'node:fs';
import unzipper from 'unzipper';

import { queueLogger } from '../../logger.js';
import { createTempDir } from '@/misc/create-temp.js';
import { downloadUrl } from '@/misc/download-url.js';
import { DriveFiles, Emojis } from '@/models/index.js';
import { DbUserImportJobData } from '@/queue/types.js';
import { addFile } from '@/services/drive/add-file.js';
import { genId } from '@/misc/gen-id.js';
import { db } from '@/db/postgre.js';

const logger = queueLogger.createSubLogger('import-custom-emojis');

// TODO: 名前衝突時の動作を選べるようにする
export async function importCustomEmojis(job: Bull.Job<DbUserImportJobData>, done: any): Promise<void> {
	logger.info(`Importing custom emojis ...`);

	const file = await DriveFiles.findOneBy({
		id: job.data.fileId,
	});
	if (file == null) {
		done();
		return;
	}

	const [path, cleanup] = await createTempDir();

	logger.info(`Temp dir is ${path}`);

	const destPath = path + '/emojis.zip';

	try {
		fs.writeFileSync(destPath, '', 'binary');
		await downloadUrl(file.url, destPath);
	} catch (e) { // TODO: 何度か再試行
		if (e instanceof Error || typeof e === 'string') {
			logger.error(e);
		}
		throw e;
	}

	const outputPath = path + '/emojis';
	const unzipStream = fs.createReadStream(destPath);
	const extractor = unzipper.Extract({ path: outputPath });
	
	extractor.on('error', (err) => {
		logger.error('Failed to extract zip file', err);
		cleanup();
		done(new Error('Failed to extract zip file: ' + err.message));
	});
	
	extractor.on('close', async () => {
		try {
			// Check if meta.json exists
			const metaPath = outputPath + '/meta.json';
			if (!fs.existsSync(metaPath)) {
				throw new Error('meta.json not found in zip file');
			}

			const metaRaw = fs.readFileSync(metaPath, 'utf-8');
			const meta = JSON.parse(metaRaw);

			// Validate meta structure
			if (!meta.emojis || !Array.isArray(meta.emojis)) {
				throw new Error('Invalid meta.json format: missing or invalid emojis array');
			}

			let importedCount = 0;
			let skippedCount = 0;

			for (const record of meta.emojis) {
				if (!record.downloaded) {
					skippedCount++;
					continue;
				}
				
				const emojiInfo = record.emoji;
				if (!emojiInfo || !emojiInfo.name) {
					logger.warn('Skipping emoji with missing name');
					skippedCount++;
					continue;
				}

				const emojiPath = outputPath + '/' + record.fileName;
				
				// Check if file exists
				if (!fs.existsSync(emojiPath)) {
					logger.warn(`Emoji file not found: ${record.fileName}`);
					skippedCount++;
					continue;
				}

				try {
					// Delete existing emoji with same name
					await Emojis.delete({
						name: emojiInfo.name,
					});
					
					const driveFile = await addFile({ user: null, path: emojiPath, name: record.fileName, force: true });
					await Emojis.insert({
						id: genId(),
						updatedAt: new Date(),
						name: emojiInfo.name,
						category: emojiInfo.category || null,
						host: null,
						aliases: emojiInfo.aliases || [],
						originalUrl: driveFile.url,
						publicUrl: driveFile.webpublicUrl ?? driveFile.url,
						type: driveFile.webpublicType ?? driveFile.type,
					});
					importedCount++;
				} catch (err) {
					logger.error(`Failed to import emoji ${emojiInfo.name}`, err);
					skippedCount++;
				}
			}

			await db.queryResultCache!.remove(['meta_emojis']);

			cleanup();
		
			logger.succ(`Imported ${importedCount} emojis (${skippedCount} skipped)`);
			done();
		} catch (err) {
			logger.error('Failed to import custom emojis', err);
			cleanup();
			done(err);
		}
	});
	
	unzipStream.pipe(extractor);
	logger.succ(`Unzipping to ${outputPath}`);
}
