import Bull from 'bull';
import { Users } from '@/models/index.js';
import { queueLogger } from '../../logger.js';
import { IsNull, LessThan, MoreThan } from 'typeorm';
import { scheduleDailyChecks } from '@/services/subscription-jobs.js';

const logger = queueLogger.createSubLogger('check-subscriptions');

/**
 * Check for subscriptions that need to be processed
 */
export async function checkSubscriptions(job: Bull.Job<Record<string, unknown>>, done: any): Promise<void> {
  logger.info('Running daily subscription and credit check...');
  
  try {
    // Schedule daily checks for all users with subscription/credit data
    const checkedUsers = await scheduleDailyChecks();
    
    if (checkedUsers > 0) {
      logger.info(`Scheduled daily checks for ${checkedUsers} users with subscriptions or credits`);
    } else {
      logger.info('No users found requiring subscription checks');
    }

    logger.succ('Subscription check completed');
    done();
  } catch (error) {
    logger.error(`Error in subscription check job: ${error}`, { error });
    done(error);
  }
}
