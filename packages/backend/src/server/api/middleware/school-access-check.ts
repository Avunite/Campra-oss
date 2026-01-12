import { ILocalUser } from '@/models/entities/user.js';
import { Schools, UserProfiles } from '@/models/index.js';
import { SchoolService } from '@/services/school-service.js';
import Logger from '@/services/logger.js';

const logger = new Logger('school-access-check');

/**
 * Middleware to check if user's school has active subscription
 * Blocks access for students from suspended schools
 */
export async function checkSchoolAccess(user: ILocalUser): Promise<{
    hasAccess: boolean;
    reason?: string;
    schoolStatus?: string;
}> {
    // Staff accounts and school admins always have access regardless of school billing status
    // Get user profile to check email
    const userProfile = await UserProfiles.findOneBy({ userId: user.id });
    const userEmail = userProfile?.email;
    const isStaff = userEmail ? SchoolService.isStaffEmail(userEmail) : false;
    
    if (user.isStaff || user.isAdmin || user.isSchoolAdmin || isStaff) {
        return { hasAccess: true };
    }

    // Users without schools (legacy accounts) get access
    if (!user.schoolId) {
        return { hasAccess: true };
    }

    try {
        // Check if school has active subscription
        const hasActiveSubscription = await SchoolService.hasActiveSubscription(user.schoolId);
        
        if (!hasActiveSubscription) {
            // Get school details for better error reporting
            const school = await Schools.findOneBy({ id: user.schoolId });
            const schoolStatus = school?.subscriptionStatus || 'unknown';
            
            logger.warn(`Access denied for user ${user.id} from school ${user.schoolId} - school status: ${schoolStatus}`);
            
            return {
                hasAccess: false,
                reason: getAccessDeniedReason(schoolStatus),
                schoolStatus
            };
        }

        return { hasAccess: true };
    } catch (error: any) {
        logger.error(`Error checking school access for user ${user.id}: ${error.message}`);
        // In case of error, deny access to be safe
        return {
            hasAccess: false,
            reason: 'SCHOOL_ACCESS_CHECK_ERROR'
        };
    }
}

/**
 * Get user-friendly reason for access denial based on school status
 */
function getAccessDeniedReason(schoolStatus: string): string {
    switch (schoolStatus) {
        case 'suspended':
            return 'SCHOOL_SUBSCRIPTION_SUSPENDED';
        case 'cancelled':
            return 'SCHOOL_SUBSCRIPTION_CANCELLED';
        case 'inactive':
            return 'SCHOOL_SUBSCRIPTION_INACTIVE';
        case 'past_due':
            return 'SCHOOL_PAYMENT_OVERDUE';
        case 'trialing':
            // Trialing should normally grant access, but if we're here it means trial has issues
            return 'SCHOOL_TRIAL_EXPIRED';
        default:
            return 'SCHOOL_SUBSCRIPTION_REQUIRED';
    }
}

/**
 * Express middleware wrapper for school access check
 */
export function createSchoolAccessMiddleware() {
    return async (req: any, res: any, next: any) => {
        // Skip check if no authenticated user
        if (!req.user) {
            return next();
        }

        const accessCheck = await checkSchoolAccess(req.user);
        
        if (!accessCheck.hasAccess) {
            return res.status(403).json({
                error: {
                    message: getAccessDeniedMessage(accessCheck.reason || 'SCHOOL_SUBSCRIPTION_REQUIRED'),
                    code: accessCheck.reason || 'SCHOOL_SUBSCRIPTION_REQUIRED',
                    id: 'school-access-denied',
                    schoolStatus: accessCheck.schoolStatus
                }
            });
        }

        next();
    };
}

/**
 * Get user-friendly access denied message
 */
function getAccessDeniedMessage(reason: string): string {
    switch (reason) {
        case 'SCHOOL_SUBSCRIPTION_SUSPENDED':
            return 'Your school\'s Campra subscription has been suspended due to payment issues. Contact your school administration to restore access.';
        case 'SCHOOL_SUBSCRIPTION_CANCELLED':
            return 'Your school\'s Campra subscription has been cancelled. Contact your school administration about reactivating access.';
        case 'SCHOOL_SUBSCRIPTION_INACTIVE':
            return 'Your school\'s Campra subscription is inactive. Contact your school administration to activate access.';
        case 'SCHOOL_PAYMENT_OVERDUE':
            return 'Your school\'s Campra payment is overdue. Contact your school administration to resolve payment issues.';
        case 'SCHOOL_TRIAL_EXPIRED':
            return 'Your school\'s trial period has expired. Contact your school administration to set up billing and continue access.';
        default:
            return 'Your school needs an active Campra subscription for access. Contact your school administration to set up billing.';
    }
}
