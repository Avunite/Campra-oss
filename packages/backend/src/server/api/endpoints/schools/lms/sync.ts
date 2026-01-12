import define from '../../../define.js';
import { Schools } from '@/models/index.js';
import { LMSService } from '@/services/lms-service.js';
import { ApiError } from '../../../error.js';

export const meta = {
    tags: ['schools', 'lms'],
    requireCredential: true,

    description: 'Manually trigger LMS data sync (school admin only)',

    res: {
        type: 'object',
        optional: false,
        nullable: false,
        properties: {
            success: {
                type: 'boolean',
                optional: false,
                nullable: false,
            },
            syncLog: {
                type: 'object',
                optional: true,
                nullable: true,
            },
        },
    },

    errors: {
        accessDenied: {
            message: 'Access denied: School admin access required',
            code: 'ACCESS_DENIED',
            id: 'lms-sync-001',
        },
        lmsNotConfigured: {
            message: 'LMS not configured for this school',
            code: 'LMS_NOT_CONFIGURED',
            id: 'lms-sync-002',
        },
    },
} as const;

export const paramDef = {
    type: 'object',
    properties: {},
    required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
    // Check if user is school admin
    if (!user.isSchoolAdmin || !user.adminForSchoolId) {
        throw new ApiError(meta.errors.accessDenied);
    }

    const schoolId = user.adminForSchoolId;
    const school = await Schools.findOneBy({ id: schoolId });
    if (!school) {
        throw new ApiError(meta.errors.accessDenied);
    }

    if (!school.metadata?.lms) {
        throw new ApiError(meta.errors.lmsNotConfigured);
    }

    try {
        const syncLog = await LMSService.syncStudents(schoolId);

        return {
            success: true,
            syncLog: {
                id: syncLog.id,
                status: syncLog.status,
                recordsProcessed: syncLog.recordsProcessed,
                recordsUpdated: syncLog.recordsUpdated,
                recordsFailed: syncLog.recordsFailed,
                createdAt: syncLog.createdAt,
                completedAt: syncLog.completedAt,
            },
        };
    } catch (error: any) {
        throw new ApiError({
            message: `Sync failed: ${error.message}`,
            code: 'SYNC_FAILED',
            id: 'lms-sync-003',
        });
    }
});
