import { Users } from '@/models/index.js';
import Logger from '@/services/logger.js';
// TODO: Update for team-based subscription system
// import { SubscriptionManager } from '@/services/subscription-manager.js';
import { LessThan, MoreThan } from 'typeorm';

const logger = new Logger('billingResumeService');

/**
 * Service to handle billing resumption when credits expire
 */
export class BillingResumeService {
  
  /**
   * Check for users whose credits are expiring and need billing resumed
   */
  public static async checkForBillingResumption(): Promise<void> {
    logger.info('Checking for users requiring billing resumption...');
    
    try {
      const now = new Date();
      const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Next 24 hours
      
      // Find users with credits expiring soon who have paused subscriptions
      const usersToResume = await Users.find({
        where: [
          {
            campraPlusCreditsExpiry: LessThan(soon),
            campraPlusCredits: MoreThan(0),
            pausedSubscriptionId: MoreThan('')
          },
          {
            miniPlusCreditsExpiry: LessThan(soon),
            miniPlusCredits: MoreThan(0),
            pausedSubscriptionId: MoreThan('')
          }
        ],
        select: ['id', 'pausedSubscriptionId', 'campraPlusCreditsExpiry', 'miniPlusCreditsExpiry']
      });
      
      if (usersToResume.length === 0) {
        logger.info('No users found requiring billing resumption');
        return;
      }
      
      logger.info(`Found ${usersToResume.length} users requiring billing resumption check`);
      
      for (const user of usersToResume) {
        try {
          // Check if credits have actually expired
          const hasExpiredCredits = this.hasExpiredCredits(user, now);
          
          if (hasExpiredCredits && user.pausedSubscriptionId) {
            logger.info(`Resuming billing for user ${user.id} - credits expired`);
            
            // Resume the paused subscription
            const resumed = await SubscriptionManager.resumeStripeSubscription(
              user.pausedSubscriptionId,
              user.id
            );
            
            if (resumed) {
              logger.info(`Successfully resumed billing for user ${user.id}`);
            } else {
              logger.warn(`Failed to resume billing for user ${user.id}`);
            }
          }
        } catch (error) {
          logger.error(`Error processing billing resumption for user ${user.id}:`, error);
        }
      }
      
    } catch (error) {
      logger.error('Error checking for billing resumption:', error);
      throw error;
    }
  }
  
  /**
   * Check if user has expired credits
   */
  private static hasExpiredCredits(user: any, now: Date): boolean {
    const campraPlusExpired = user.campraPlusCreditsExpiry && 
                              user.campraPlusCreditsExpiry <= now;
    const miniPlusExpired = user.miniPlusCreditsExpiry && 
                           user.miniPlusCreditsExpiry <= now;
    
    return campraPlusExpired || miniPlusExpired;
  }
  
  /**
   * Schedule billing resumption checks to run every hour
   */
  public static scheduleRegularChecks(): any {
    logger.info('Starting regular billing resumption checks (every hour)');
    
    return setInterval(async () => {
      try {
        await this.checkForBillingResumption();
      } catch (error) {
        logger.error('Error in scheduled billing resumption check:', error);
      }
    }, 60 * 60 * 1000); // Every hour
  }
}

export default BillingResumeService;
