import Bull from 'bull';
import Logger from '@/services/logger.js';
import { Users } from '@/models/index.js';
import { SubscriptionJobData } from '@/queue/types.js';
import { User } from '@/models/entities/user.js';
// TODO: Update for team-based subscription system
// import { SubscriptionManager } from '@/services/subscription-manager.js';

const logger = new Logger('subscriptionProcessor');

/**
 * Process subscription-related jobs
 * TODO: Update this processor for team-based subscription system
 */
export async function processSubscription(job: Bull.Job<SubscriptionJobData>, done: any): Promise<void> {
  // Individual subscription system has been removed - this processor needs to be updated for team-based subscriptions
  logger.info('Subscription processor called but individual subscription system has been removed');
  done();
  return;
}

/* TODO: Reimplement for team-based subscription system
async function handleUserExpiration(user: User): Promise<void> {
  // This function needs to be reimplemented for team-based subscriptions
}

async function handleDailyCheck(user: User): Promise<void> {
  // This function needs to be reimplemented for team-based subscriptions
}
*/
