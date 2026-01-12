import define from '../../../define.js';
import { Schools } from '@/models/index.js';
import { LMSService } from '@/services/lms-service.js';
import { ApiError } from '../../../error.js';

export const meta = {
    tags: ['schools', 'lms'],
    requireCredential: true,

    description: 'Configure LMS connection for a school (school admin only)',

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
            connection: {
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
            id: 'lms-connect-001',
        },
        invalidConfig: {
            message: 'Invalid LMS configuration',
            code: 'INVALID_CONFIG',
            id: 'lms-connect-002',
        },
    },
} as const;

export const paramDef = {
    type: 'object',
    properties: {
        lmsType: {
            type: 'string',
            enum: ['blackboard', 'blackbaud', 'canvas', 'powerschool', 'oneroster'],
        },
        lmsName: {
            type: 'string',
            maxLength: 128,
            nullable: true,
        },
        apiUrl: {
            type: 'string',
            maxLength: 512,
        },
        clientId: {
            type: 'string',
            maxLength: 256,
        },
        clientSecret: {
            type: 'string',
            maxLength: 512,
        },
        autoSync: {
            type: 'boolean',
            default: false,
        },
        syncFrequency: {
            type: 'string',
            enum: ['hourly', 'daily', 'weekly'],
            default: 'daily',
        },
    },
    required: ['lmsType', 'apiUrl', 'clientId', 'clientSecret'],
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

    // Update school metadata with LMS configuration
    await Schools.update(schoolId, {
        metadata: {
            ...school.metadata,
            lms: {
                type: ps.lmsType,
                name: ps.lmsName || ps.lmsType,
                apiUrl: ps.apiUrl,
                clientId: ps.clientId,
                clientSecret: ps.clientSecret,
                connectionStatus: 'disconnected', // Will be set to active after OAuth or test
                autoSync: ps.autoSync,
                syncFrequency: ps.syncFrequency,
            },
        },
    });

    // Test the connection
    try {
        const isValid = await LMSService.testConnection(schoolId);
        if (isValid) {
            return {
                success: true,
                connection: {
                    type: ps.lmsType,
                    name: ps.lmsName || ps.lmsType,
                    status: 'active',
                },
            };
        } else {
            return {
                success: false,
                connection: {
                    type: ps.lmsType,
                    name: ps.lmsName || ps.lmsType,
                    status: 'error',
                },
            };
        }
    } catch (error: any) {
        return {
            success: false,
            connection: {
                type: ps.lmsType,
                name: ps.lmsName || ps.lmsType,
                status: 'error',
                error: error.message,
            },
        };
    }
});
