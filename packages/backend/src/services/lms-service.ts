import { Schools, LMSSyncLogs, Users, UserProfiles } from '@/models/index.js';
import { School } from '@/models/entities/school.js';
import { LMSSyncLog } from '@/models/entities/lms-sync-log.js';
import { BaseLMSAdapter, type LMSCredentials, type LMSStudent } from './lms/base-adapter.js';
import { OneRosterAdapter } from './lms/oneroster-adapter.js';
import { genId } from '@/misc/gen-id.js';
import Logger from './logger.js';

const logger = new Logger('lms-service');

/**
 * Service for managing LMS connections and data synchronization
 */
export class LMSService {
    /**
     * Save updated LMS credentials to database (after token refresh)
     */
    private static async saveCredentials(school: School, adapter: BaseLMSAdapter): Promise<void> {
        const credentials = adapter.getCredentials();

        // Only update if credentials have meaningful changes
        if (credentials.accessToken || credentials.refreshToken || credentials.expiresAt) {
            await Schools.update(school.id, {
                metadata: {
                    ...school.metadata,
                    lms: {
                        ...school.metadata?.lms,
                        accessToken: credentials.accessToken,
                        refreshToken: credentials.refreshToken,
                        expiresAt: credentials.expiresAt?.toISOString(),
                    },
                },
            });
            logger.info(`Saved updated LMS credentials for school ${school.id}`);
        }
    }

    /**
     * Create appropriate adapter instance based on LMS type
     */
    private static createAdapter(school: School): BaseLMSAdapter {
        if (!school.metadata?.lms) {
            throw new Error('LMS not configured for this school');
        }

        const lms = school.metadata.lms;
        const credentials: LMSCredentials = {
            clientId: lms.clientId,
            clientSecret: lms.clientSecret,
            accessToken: lms.accessToken,
            refreshToken: lms.refreshToken,
            expiresAt: lms.expiresAt ? new Date(lms.expiresAt) : undefined,
        };

        switch (lms.type) {
            case 'oneroster':
                return new OneRosterAdapter(lms.apiUrl, credentials);
            case 'canvas':
                // TODO: Implement CanvasAdapter
                throw new Error('Canvas adapter not yet implemented. Please use OneRoster for Canvas integration.');
            case 'blackbaud':
                // TODO: Implement BlackbaudAdapter
                throw new Error('Blackbaud adapter not yet implemented. Please use OneRoster for Blackbaud integration.');
            case 'schoology':
                // TODO: Implement SchoologyAdapter
                throw new Error('Schoology adapter not yet implemented. Please use OneRoster for Schoology integration.');
            case 'powerschool':
                // TODO: Implement PowerSchoolAdapter
                throw new Error('PowerSchool adapter not yet implemented. Please use OneRoster for PowerSchool integration.');
            case 'google-classroom':
                // TODO: Implement Google Classroom Adapter
                throw new Error('Google Classroom adapter not yet implemented.');
            case 'microsoft-teams':
                // TODO: Implement Microsoft Teams Adapter
                throw new Error('Microsoft Teams adapter not yet implemented.');
            case 'moodle':
                // TODO: Implement MoodleAdapter
                throw new Error('Moodle adapter not yet implemented.');
            case 'brightspace':
                // TODO: Implement Brightspace/D2L Adapter
                throw new Error('Brightspace/D2L adapter not yet implemented.');
            case 'sakai':
                // TODO: Implement SakaiAdapter
                throw new Error('Sakai adapter not yet implemented.');
            default:
                throw new Error(`Unsupported LMS type: ${lms.type}`);
        }
    }

    /**
     * Test LMS connection
     */
    public static async testConnection(schoolId: string): Promise<boolean> {
        const school = await Schools.findOneBy({ id: schoolId });
        if (!school || !school.metadata?.lms) {
            throw new Error('LMS not configured');
        }

        try {
            const adapter = this.createAdapter(school);
            const isValid = await adapter.testConnection();

            // Save credentials in case token was refreshed during connection test
            await this.saveCredentials(school, adapter);

            // Update connection status
            const previousStatus = school.metadata.lms.connectionStatus;
            await Schools.update(schoolId, {
                metadata: {
                    ...school.metadata,
                    lms: {
                        ...school.metadata.lms,
                        connectionStatus: isValid ? 'active' : 'error',
                    },
                },
            });

            // If connection was restored from error state, trigger waitlist notifications
            if (previousStatus === 'error' && isValid) {
                logger.info(`LMS connection for school ${schoolId} restored, will notify waitlist`);
                // This will be handled by RegistrationWaitlistService via integration hooks
            }

            return isValid;
        } catch (error: any) {
            logger.error(`Connection test failed for school ${schoolId}:`, error);

            if (school.metadata?.lms) {
                await Schools.update(schoolId, {
                    metadata: {
                        ...school.metadata,
                        lms: {
                            ...school.metadata.lms,
                            connectionStatus: 'error',
                        },
                    },
                });
            }

            return false;
        }
    }

    /**
     * Validate that a student email exists in the LMS (for registration)
     * FAIL CLOSED: Throws error if LMS is unreachable
     */
    public static async validateStudentEmail(
        schoolId: string,
        email: string,
    ): Promise<boolean> {
        const school = await Schools.findOneBy({ id: schoolId });
        if (!school || !school.metadata?.lms) {
            throw new Error('LMS_NOT_CONFIGURED');
        }

        if (school.metadata.lms.connectionStatus !== 'active') {
            throw new Error('LMS_VALIDATION_FAILED');
        }

        try {
            const adapter = this.createAdapter(school);
            // EDGE CASE FIX #3: Ensure case-insensitive email matching
            const student = await adapter.fetchStudentByEmail(email.toLowerCase());

            // Save credentials in case token was refreshed during validation
            await this.saveCredentials(school, adapter);

            return !!student;
        } catch (error: any) {
            // FAIL CLOSED - throw error to block registration
            logger.error(`LMS validation failed for ${email}:`, error);
            throw new Error('LMS_VALIDATION_FAILED');
        }
    }

    /**
     * Sync students from LMS
     */
    public static async syncStudents(schoolId: string): Promise<LMSSyncLog> {
        const school = await Schools.findOneBy({ id: schoolId });
        if (!school || !school.metadata?.lms) {
            throw new Error('LMS not configured');
        }

        // EDGE CASE FIX #2: Prevent concurrent syncs
        if (school.metadata.lms.syncInProgress) {
            throw new Error('Sync already in progress. Please wait for current sync to complete.');
        }

        // Set sync lock
        await Schools.update(schoolId, {
            metadata: {
                ...school.metadata,
                lms: {
                    ...school.metadata.lms,
                    syncInProgress: true,
                    lastSyncStarted: new Date().toISOString(),
                },
            },
        });

        // Create sync log
        const syncLog = await LMSSyncLogs.save({
            id: genId(),
            schoolId: schoolId,
            syncType: 'manual',
            status: 'started',
            recordsProcessed: 0,
            recordsUpdated: 0,
            recordsFailed: 0,
            createdAt: new Date(),
            completedAt: null,
            errorDetails: null,
        });

        try {
            const adapter = this.createAdapter(school);
            const lmsStudents = await adapter.fetchStudents();

            // Save credentials in case token was refreshed during fetch
            await this.saveCredentials(school, adapter);

            // EDGE CASE FIX #5: Deduplicate students by email
            const uniqueStudents = Array.from(
                new Map(lmsStudents.map(s => [s.email.toLowerCase(), s])).values()
            );

            if (lmsStudents.length !== uniqueStudents.length) {
                logger.warn(`Removed ${lmsStudents.length - uniqueStudents.length} duplicate students from LMS response`);
            }

            let updated = 0;
            let failed = 0;
            const failedRecords: Array<{ email: string; error: string }> = [];

            for (const lmsStudent of uniqueStudents) {
                try {
                    await this.updateStudentFromLMS(schoolId, lmsStudent);
                    updated++;
                } catch (error: any) {
                    failed++;
                    failedRecords.push({
                        email: lmsStudent.email,
                        error: error.message,
                    });
                    logger.error(`Failed to update student ${lmsStudent.email}:`, error);
                }
            }

            // Update sync log
            await LMSSyncLogs.update(syncLog.id, {
                status: failed > 0 ? 'partial' : 'completed',
                recordsProcessed: uniqueStudents.length,
                recordsUpdated: updated,
                recordsFailed: failed,
                errorDetails: failed > 0 ? { failedRecords } : null,
                completedAt: new Date(),
            });

            // Update school metadata and clear sync lock
            await Schools.update(schoolId, {
                metadata: {
                    ...school.metadata,
                    lms: {
                        ...school.metadata.lms,
                        lastSyncAt: new Date().toISOString(),
                        syncInProgress: false,
                    },
                },
            });

            logger.info(`Sync completed for school ${schoolId}: ${updated}/${uniqueStudents.length} students updated`);
        } catch (error: any) {
            await LMSSyncLogs.update(syncLog.id, {
                status: 'failed',
                errorDetails: {
                    message: error.message,
                    stack: error.stack,
                },
                completedAt: new Date(),
            });

            // CRITICAL: Clear sync lock on error
            await Schools.update(schoolId, {
                metadata: {
                    ...school.metadata,
                    lms: {
                        ...school.metadata.lms,
                        syncInProgress: false,
                    },
                },
            });

            throw error;
        }

        return await LMSSyncLogs.findOneByOrFail({ id: syncLog.id });
    }

    /**
     * Update individual student from LMS data
     */
    private static async updateStudentFromLMS(
        schoolId: string,
        lmsStudent: LMSStudent,
    ): Promise<void> {
        // Find user by email AND schoolId to prevent cross-school collisions
        // EDGE CASE FIX #11: Cross-school email collision prevention
        const profile = await UserProfiles.findOne({
            where: { email: lmsStudent.email.toLowerCase() },
            relations: ['user'],
        });

        if (!profile || !profile.user) {
            logger.warn(`Student ${lmsStudent.email} not found in Campra`);
            return;
        }

        // CRITICAL: Verify student belongs to THIS school
        if (profile.user.schoolId !== schoolId) {
            logger.warn(`Student ${lmsStudent.email} belongs to different school (${profile.user.schoolId}), skipping sync`);
            return;
        }

        const user = profile.user;

        // EDGE CASE FIX #1: Skip non-student accounts
        // Common bug: admins/teachers sometimes appear in LMS student lists
        if (user.isSchoolAdmin || user.isTeacher) {
            logger.info(`Skipping non-student account ${lmsStudent.email} during student sync`);
            return;
        }

        // EDGE CASE FIX #4: Skip students who are leaving/have left
        if (user.isLeaving) {
            logger.info(`Skipping leaving student ${lmsStudent.email} during sync`);
            return;
        }

        const updates: any = {};

        // Update graduation date if available
        if (lmsStudent.graduationDate) {
            updates.graduationDate = lmsStudent.graduationDate;
        }

        // Update graduation year if available
        if (lmsStudent.graduationYear) {
            updates.graduationYear = lmsStudent.graduationYear;
        }

        // Update grade level if available
        if (lmsStudent.gradeLevel) {
            updates.gradeLevel = lmsStudent.gradeLevel;
        }

        // Update enrollment status if available
        if (lmsStudent.enrollmentStatus) {
            updates.enrollmentStatus = lmsStudent.enrollmentStatus;
        }

        if (Object.keys(updates).length > 0) {
            await Users.update(profile.userId, updates);
            logger.info(`Updated student ${lmsStudent.email} from LMS`);
        }
    }
}
