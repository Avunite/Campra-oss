import define from '../../../define.js';
import { Schools } from '@/models/index.js';
import { LMSService } from '@/services/lms-service.js';
import { ApiError } from '../../../error.js';

export const meta = {
    tags: ['schools', 'lms'],
    requireCredential: true,

    description: 'Disconnect LMS integration for a school (school admin only)',

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
        },
    },

    errors: {
        accessDenied: {
            message: 'Access denied: School admin access required',
            code: 'ACCESS_DENIED',
            id: 'lms-disconnect-001',
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

    // Remove LMS configuration from metadata
    await Schools.update(schoolId, {
        metadata: {
            ...school.metadata,
            lms: undefined,
        },
        registrationSettings: {
            ...school.registrationSettings,
            requireLMSValidation: false,
        },
    });

    return {
        success: true,
    };
});
