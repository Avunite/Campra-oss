import define from '../../../define.js';
import { Schools, LMSSyncLogs } from '@/models/index.js';
import { ApiError } from '../../../error.js';

export const meta = {
    tags: ['schools', 'lms'],
    requireCredential: true,

    description: 'Get LMS connection status and sync history (school admin only)',

    res: {
        type: 'object',
        optional: false,
        nullable: false,
        properties: {
            connected: {
                type: 'boolean',
                optional: false,
                nullable: false,
            },
            connection: {
                type: 'object',
                optional: true,
                nullable: true,
            },
            recentSyncs: {
                type: 'array',
                optional: false,
                nullable: false,
            },
        },
    },

    errors: {
        accessDenied: {
            message: 'Access denied: School admin access required',
            code: 'ACCESS_DENIED',
            id: 'lms-status-001',
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

    // Get LMS connection info
    const lms = school.metadata?.lms;
    const connected = !!lms;

    // Get recent sync logs
    const recentSyncs = await LMSSyncLogs.find({
        where: { schoolId },
        order: { createdAt: 'DESC' },
        take: 10,
    });

    return {
        connected,
        connection: lms
            ? {
                type: lms.type,
                name: lms.name,
                apiUrl: lms.apiUrl,
                connectionStatus: lms.connectionStatus,
                autoSync: lms.autoSync,
                syncFrequency: lms.syncFrequency,
                lastSyncAt: lms.lastSyncAt,
            }
            : null,
        recentSyncs: recentSyncs.map((sync) => ({
            id: sync.id,
            status: sync.status,
            syncType: sync.syncType,
            recordsProcessed: sync.recordsProcessed,
            recordsUpdated: sync.recordsUpdated,
            recordsFailed: sync.recordsFailed,
            createdAt: sync.createdAt,
            completedAt: sync.completedAt,
        })),
    };
});
