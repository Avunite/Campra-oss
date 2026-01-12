// TODO: Update this file for team-based subscription system
// Individual subscription system has been removed
import { User } from '@/models/entities/user.js';
import { subscriptionQueue } from '@/queue/queues.js';
import { SubscriptionJobData } from '@/queue/types.js';

/**
 * Create a job to check if a user's subscription is expiring
 */
export function createCheckExpiringSubscriptionJob(userId: User['id']) {
  return subscriptionQueue.add({
    userId,
    action: 'check-expiring',
  } as SubscriptionJobData, {
    removeOnComplete: true,
    removeOnFail: true,
  });
}

/**
 * Create a job for daily subscription/credit checks
 */
export function createDailyCheckJob(userId: User['id']) {
  return subscriptionQueue.add({
    userId,
    action: 'daily-check',
  } as SubscriptionJobData, {
    removeOnComplete: true,
    removeOnFail: true,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  });
}

/**
 * Schedule daily check jobs for all active users with subscriptions or credits
 * NOTE: Individual subscription system has been removed in favor of school-based billing
 */
export async function scheduleDailyChecks() {
  // Individual subscription system removed - no users to check
  return 0;
}
