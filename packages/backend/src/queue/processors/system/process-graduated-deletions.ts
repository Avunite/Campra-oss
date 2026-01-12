import Logger from '@/services/logger.js';
import { GraduatedStudents, Users, UserProfiles } from '@/models/index.js';
import { LessThan } from 'typeorm';
import { createDeleteAccountJob } from '@/queue/index.js';
import { genId } from '@/misc/id.js';

const logger = new Logger('process-graduated-deletions');

const GRACE_PERIOD_WARNING_DAYS = 7; // Send warning 7 days before deletion

export async function processGraduatedDeletions(): Promise<string> {
	logger.info('Starting graduated student deletion processing...');

	try {
		const now = new Date();

		// 1. Send warnings to students whose grace period ends soon
		const warningDate = new Date(now);
		warningDate.setDate(warningDate.getDate() + GRACE_PERIOD_WARNING_DAYS);

		const studentsToWarn = await GraduatedStudents.find({
			where: {
				gracePeriodEndsAt: LessThan(warningDate),
				notifiedAboutDeletion: false,
			},
			relations: ['user'],
		});

		for (const record of studentsToWarn) {
			try {
				// Create notification for the user
				// Note: You'll need to implement the notification system
				logger.info(`Should send deletion warning to user ${record.userId}. Grace period ends: ${record.gracePeriodEndsAt}`);

				// Mark as notified
				await GraduatedStudents.update(record.id, {
					notifiedAboutDeletion: true,
					notifiedAt: now,
				});
			} catch (error: any) {
				logger.error(`Failed to warn user ${record.userId}: ${error.message}`);
			}
		}

		// 2. Delete accounts whose grace period has ended
		const studentsToDelete = await GraduatedStudents.find({
			where: {
				gracePeriodEndsAt: LessThan(now),
			},
		});

		let deletedCount = 0;

		for (const record of studentsToDelete) {
			try {
				const user = await Users.findOneBy({ id: record.userId });

				if (!user) {
					logger.warn(`User ${record.userId} not found, skipping deletion`);
					await GraduatedStudents.delete(record.id);
					continue;
				}

				// Queue account deletion job
				await createDeleteAccountJob({ id: user.id, username: user.username, host: null }, { soft: false });

				// Delete the graduated student record
				await GraduatedStudents.delete(record.id);

				deletedCount++;
				logger.info(`Queued deletion for graduated user ${record.userId}`);
			} catch (error: any) {
				logger.error(`Failed to queue deletion for user ${record.userId}: ${error.message}`);
			}
		}

		logger.succ(`Graduated student deletion processing complete. Warned: ${studentsToWarn.length}, Deleted: ${deletedCount}`);

		return `Processed ${studentsToWarn.length} warnings and ${deletedCount} deletions`;
	} catch (error: any) {
		logger.error(`Graduated deletion processing failed: ${error.message}`);
		throw error;
	}
}
