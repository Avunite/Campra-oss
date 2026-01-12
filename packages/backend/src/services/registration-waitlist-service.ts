import { In } from 'typeorm';
import { RegistrationWaitlists, Schools } from '@/models/index.js';
import { RegistrationWaitlist } from '@/models/entities/registration-waitlist.js';
import { SchoolService } from './school-service.js';
import { sendEmail } from './send-email.js';
import { genId } from '@/misc/gen-id.js';
import config from '@/config/index.js';
import Logger from './logger.js';

const logger = new Logger('registration-waitlist');

/**
 * Service for managing registration waitlist and notifications
 */
export class RegistrationWaitlistService {
    /**
     * Add a student to the registration waitlist
     */
    public static async addToWaitlist(
        email: string,
        schoolId: string,
        blockedReason: RegistrationWaitlist['blockedReason'],
        name?: string,
    ): Promise<RegistrationWaitlist> {
        email = email.toLowerCase().trim();

        // Check if already on waitlist
        const existing = await RegistrationWaitlists.findOne({
            where: { schoolId, email, registered: false },
        });

        if (existing) {
            // Update attempt count
            await RegistrationWaitlists.update(existing.id, {
                metadata: {
                    ...existing.metadata,
                    attemptCount: (existing.metadata?.attemptCount || 1) + 1,
                },
            });
            return existing;
        }

        // Create new waitlist entry
        const waitlist = await RegistrationWaitlists.save({
            id: genId(),
            schoolId,
            email,
            name: name || null,
            blockedReason,
            notified: false,
            registered: false,
            createdAt: new Date(),
            metadata: {
                attemptCount: 1,
            },
        });

        logger.info(`Added ${email} to waitlist for school ${schoolId} (reason: ${blockedReason})`);
        return waitlist;
    }

    /**
     * Notify waitlisted students when registration opens
     */
    public static async notifyWaitlist(
        schoolId: string,
        reason: string | string[],
        limit?: number,
    ): Promise<number> {
        const school = await Schools.findOneBy({ id: schoolId });
        if (!school) {
            logger.warn(`School ${schoolId} not found, skipping waitlist notification`);
            return 0;
        }

        const reasons = Array.isArray(reason) ? reason : [reason];

        // Get waitlisted students
        const waitlisted = await RegistrationWaitlists.find({
            where: {
                schoolId,
                blockedReason: In(reasons),
                notified: false,
                registered: false,
            },
            order: { createdAt: 'ASC' }, // FIFO
            take: limit || undefined,
        });

        let notifiedCount = 0;

        for (const entry of waitlisted) {
            try {
                // Re-validate eligibility
                const eligibility = await SchoolService.validateRegistrationEligibility(entry.email);

                if (eligibility.allowed) {
                    // Send invitation email
                    const signupUrl = `${config.url}/signup`;
                    const subject = `Registration is now open at ${school.name}!`;

                    const html = `
						<p>Good news! You can now register for <strong>${school.name}</strong> on Campra.</p>
						<p>The issue that was blocking registration has been resolved.</p>
						<p><a href="${signupUrl}" style="background: #e84d83; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Sign Up Now</a></p>
						<p>Use this email address: <strong>${entry.email}</strong></p>
						<p>Welcome to your campus community!</p>
					`;

                    const text = `
Good news! You can now register for ${school.name} on Campra.

The issue that was blocking registration has been resolved.

Sign up at: ${signupUrl}

Use this email address: ${entry.email}

Welcome to your campus community!
					`;

                    await sendEmail(entry.email, subject, html, text);

                    // Mark as notified
                    await RegistrationWaitlists.update(entry.id, {
                        notified: true,
                        notifiedAt: new Date(),
                    });

                    notifiedCount++;
                    logger.info(`Notified waitlisted student ${entry.email} for school ${schoolId}`);
                } else {
                    logger.info(`Student ${entry.email} still ineligible: ${eligibility.reason}`);
                }
            } catch (error: any) {
                logger.error(`Failed to notify ${entry.email}:`, error);
            }
        }

        if (notifiedCount > 0) {
            logger.info(`Notified ${notifiedCount} waitlisted students for school ${schoolId}`);
        }

        return notifiedCount;
    }

    /**
     * Mark waitlist entry as registered (called after successful signup)
     */
    public static async markRegistered(email: string, schoolId: string): Promise<void> {
        await RegistrationWaitlists.update(
            { email: email.toLowerCase(), schoolId, registered: false },
            { registered: true, registeredAt: new Date() },
        );

        logger.info(`Marked ${email} as registered in waitlist for school ${schoolId}`);
    }

    /**
     * Clean up old waitlist entries (90+ days old)
     */
    public static async cleanupOldEntries(): Promise<number> {
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

        const result = await RegistrationWaitlists.createQueryBuilder()
            .delete()
            .where('createdAt < :date', { date: ninetyDaysAgo })
            .orWhere('registered = :registered', { registered: true })
            .execute();

        const deletedCount = result.affected || 0;
        if (deletedCount > 0) {
            logger.info(`Cleaned up ${deletedCount} old waitlist entries`);
        }

        return deletedCount;
    }

    /**
     * Get waitlist stats for a school
     */
    public static async getWaitlistStats(schoolId: string): Promise<{
        total: number;
        byReason: Record<string, number>;
        notified: number;
        registered: number;
    }> {
        const waitlist = await RegistrationWaitlists.find({
            where: { schoolId, registered: false },
        });

        const stats = {
            total: waitlist.length,
            byReason: {} as Record<string, number>,
            notified: 0,
            registered: 0,
        };

        for (const entry of waitlist) {
            stats.byReason[entry.blockedReason] = (stats.byReason[entry.blockedReason] || 0) + 1;
            if (entry.notified) stats.notified++;
        }

        const registered = await RegistrationWaitlists.count({
            where: { schoolId, registered: true },
        });
        stats.registered = registered;

        return stats;
    }
}
