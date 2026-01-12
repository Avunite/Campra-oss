import Logger from '@/services/logger.js';
import { Schools } from '@/models/index.js';
import { SchoolService } from '@/services/school-service.js';

const logger = new Logger('process-graduations');

export async function processGraduations(): Promise<string> {
	logger.info('Starting graduation processing...');

	try {
		// Get all schools that have auto-graduation enabled
		const schools = await Schools.find({
			where: {
				isActive: true,
			},
			select: ['id'],
		});

		let totalProcessed = 0;
		const results: { schoolId: string; count: number }[] = [];

		// Process graduations for each school
		for (const school of schools) {
			try {
				const result = await SchoolService.processGraduations(school.id);
				totalProcessed += result.processedCount;

				if (result.processedCount > 0) {
					results.push({
						schoolId: school.id,
						count: result.processedCount,
					});
					logger.info(`Processed ${result.processedCount} graduations for school ${school.id}`);
				}
			} catch (error: any) {
				logger.error(`Failed to process graduations for school ${school.id}: ${error.message}`);
			}
		}

		logger.succ(`Graduation processing complete. Total students graduated: ${totalProcessed}`);

		return `Processed ${totalProcessed} graduations across ${schools.length} schools`;
	} catch (error: any) {
		logger.error(`Graduation processing failed: ${error.message}`);
		throw error;
	}
}
