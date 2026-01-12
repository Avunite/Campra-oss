import Bull from 'bull';
import { Schools } from '@/models/index.js';
import { queueLogger } from '../../logger.js';
import { LMSService } from '@/services/lms-service.js';

const logger = queueLogger.createSubLogger('lms-sync');

/**
 * Sync LMS data for schools with auto-sync enabled
 */
export async function lmsAutoSync(_job: Bull.Job<Record<string, unknown>>, done: any): Promise<void> {
	logger.info('Starting LMS auto-sync for schools with auto-sync enabled...');

	try {
		// Find all schools with active LMS connections using TypeORM query builder
		const schools = await Schools.createQueryBuilder('school')
			.where('school.isActive = :isActive', { isActive: true })
			.andWhere("school.metadata->'lms'->>'autoSync' = :autoSync", { autoSync: 'true' })
			.andWhere("school.metadata->'lms'->>'connectionStatus' = :status", { status: 'active' })
			.getMany();

		if (schools.length === 0) {
			logger.info('No schools with LMS auto-sync enabled found');
			done();
			return;
		}

		logger.info(`Found ${schools.length} schools with LMS auto-sync enabled`);

		const now = new Date();
		let syncedCount = 0;
		let skippedCount = 0;
		let failedCount = 0;

		for (const school of schools) {
			try {
				if (!school.metadata?.lms) {
					skippedCount++;
					continue;
				}

				const lmsConfig = school.metadata.lms;

				// Check if sync is needed based on frequency
				if (lmsConfig.lastSyncAt) {
					const lastSync = new Date(lmsConfig.lastSyncAt);
					const syncFrequency = lmsConfig.syncFrequency || 'daily';

					let shouldSync = false;

					switch (syncFrequency) {
						case 'hourly':
							// Sync if last sync was more than 1 hour ago
							shouldSync = (now.getTime() - lastSync.getTime()) > (60 * 60 * 1000);
							break;
						case 'daily':
							// Sync if last sync was more than 24 hours ago
							shouldSync = (now.getTime() - lastSync.getTime()) > (24 * 60 * 60 * 1000);
							break;
						case 'weekly':
							// Sync if last sync was more than 7 days ago
							shouldSync = (now.getTime() - lastSync.getTime()) > (7 * 24 * 60 * 60 * 1000);
							break;
						default:
							// Unknown frequency, skip
							skippedCount++;
							logger.warn(`Unknown sync frequency '${syncFrequency}' for school ${school.id}`);
							continue;
					}

					if (!shouldSync) {
						skippedCount++;
						logger.debug(`Skipping sync for school ${school.id} - last sync was too recent (${lastSync.toISOString()})`);
						continue;
					}
				}

				// Perform sync
				logger.info(`Starting LMS sync for school ${school.id} (${school.name})`);
				await LMSService.syncStudents(school.id);
				syncedCount++;
				logger.succ(`Successfully synced LMS data for school ${school.id} (${school.name})`);

			} catch (error: any) {
				failedCount++;
				logger.error(`Failed to sync LMS data for school ${school.id}: ${error.message}`, { error });
			}
		}

		logger.info(`LMS auto-sync completed: ${syncedCount} synced, ${skippedCount} skipped, ${failedCount} failed`);
		done();
	} catch (error: any) {
		logger.error(`Error in LMS auto-sync job: ${error}`, { error });
		done(error);
	}
}
