import define from '../../define.js';
import { Schools } from '@/models/index.js';
import { RegistrationWaitlistService } from '@/services/registration-waitlist-service.js';
import { sendEmail } from '@/services/send-email.js';
import { ApiError } from '../../error.js';
import config from '@/config/index.js';

export const meta = {
    tags: ['schools', 'registration'],
    requireCredential: false,

    description: 'Join registration waitlist when blocked from signing up',

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
            message: {
                type: 'string',
                optional: false,
                nullable: false,
            },
            alreadyWaitlisted: {
                type: 'boolean',
                optional: true,
                nullable: true,
            },
        },
    },

    errors: {
        schoolNotFound: {
            message: 'School not found for email domain',
            code: 'SCHOOL_NOT_FOUND',
            id: 'waitlist-001',
        },
        invalidEmail: {
            message: 'Invalid email address',
            code: 'INVALID_EMAIL',
            id: 'waitlist-002',
        },
    },
} as const;

export const paramDef = {
    type: 'object',
    properties: {
        email: {
            type: 'string',
            maxLength: 256,
        },
        name: {
            type: 'string',
            maxLength: 128,
            nullable: true,
        },
        blockedReason: {
            type: 'string',
            enum: [
                'LMS_VALIDATION_FAILED',
                'LMS_NOT_CONFIGURED',
                'NOT_ENROLLED_IN_LMS',
                'SCHOOL_REGISTRATION_CLOSED',
                'STUDENT_CAP_REACHED',
                'SCHOOL_SUBSCRIPTION_REQUIRED',
            ],
        },
    },
    required: ['email', 'blockedReason'],
} as const;

export default define(meta, paramDef, async (ps) => {
    const email = ps.email.toLowerCase().trim();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new ApiError(meta.errors.invalidEmail);
    }

    // Find school by domain
    const { SchoolService } = await import('@/services/school-service.js');
    const school = await SchoolService.findSchoolByEmailDomain(email);
    if (!school) {
        throw new ApiError(meta.errors.schoolNotFound);
    }

    // Add to waitlist
    const waitlist = await RegistrationWaitlistService.addToWaitlist(
        email,
        school.id,
        ps.blockedReason,
        ps.name,
    );

    // Send confirmation email
    const subject = `You're on the waitlist for ${school.name}`;
    const reasonMessage = getReadableReason(ps.blockedReason);

    const html = `
		<p>Thanks for your interest in joining <strong>${school.name}</strong> on Campra!</p>
		<p>Registration is currently ${reasonMessage}.</p>
		<p>We'll send you an email as soon as registration opens for your school.</p>
		<p>Your email: <strong>${email}</strong></p>
	`;

    const text = `
Thanks for your interest in joining ${school.name} on Campra!

Registration is currently ${reasonMessage}.

We'll send you an email as soon as registration opens for your school.

Your email: ${email}
	`;

    try {
        await sendEmail(email, subject, html, text);
    } catch (error) {
        // Log but don't fail - waitlist entry was already created
        console.error('Failed to send waitlist confirmation email:', error);
    }

    // Check if already waitlisted
    const alreadyWaitlisted = waitlist.metadata?.attemptCount && waitlist.metadata.attemptCount > 1;

    return {
        success: true,
        message: alreadyWaitlisted
            ? "You're already on the waitlist. We'll notify you when registration opens!"
            : "You've been added to the waitlist. We'll notify you when registration opens!",
        alreadyWaitlisted: alreadyWaitlisted || false,
    };
});

/**
 * Convert blocked reason to human-readable message
 */
function getReadableReason(reason: string): string {
    switch (reason) {
        case 'LMS_VALIDATION_FAILED':
            return 'temporarily unavailable due to a technical issue';
        case 'LMS_NOT_CONFIGURED':
            return 'being set up';
        case 'NOT_ENROLLED_IN_LMS':
            return 'limited to enrolled students';
        case 'SCHOOL_REGISTRATION_CLOSED':
            return 'currently closed';
        case 'STUDENT_CAP_REACHED':
            return 'at capacity';
        case 'SCHOOL_SUBSCRIPTION_REQUIRED':
            return 'being activated';
        default:
            return 'temporarily unavailable';
    }
}
