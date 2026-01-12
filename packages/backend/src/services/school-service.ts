import { Schools, SchoolDomains, SchoolBillings, Users, UserProfiles, GraduatedStudents, StripeCustomers, SchoolAdminVerifications, CSVImportLogs } from '@/models/index.js';
import { School } from '@/models/entities/school.js';
import { SchoolDomain } from '@/models/entities/school-domain.js';
import { SchoolBilling } from '@/models/entities/school-billing.js';
import { User } from '@/models/entities/user.js';
import { UserProfile } from '@/models/entities/user-profile.js';
import { StripePriceFetcher } from './stripe/price-fetcher.js';
import { GraduatedStudent } from '@/models/entities/graduated-student.js';
import { genId } from '@/misc/gen-id.js';
import { secureRndstr } from '@/misc/secure-rndstr.js';
import { StripeSchoolManager } from './stripe-school-manager.js';
import { EmailVerificationService } from './email-verification.js';
import { In, Not, IsNull, LessThan, MoreThan } from 'typeorm';
import Logger from './logger.js';
import bcrypt from 'bcryptjs';

const logger = new Logger('school-service');

/**
 * School service for managing school entities and operations
 */
export class SchoolService {
	/**
	 * Convert latitude/longitude coordinates to PostgreSQL point format
	 */
	private static formatCoordinatesForDB(coordinates: { latitude: number; longitude: number }): string {
		return `(${coordinates.longitude},${coordinates.latitude})`;
	}
	/**
	 * Extract school domain from email address
	 */
	public static extractDomain(email: string): string {
		// Check if email is provided and is a string
		if (!email || typeof email !== 'string') {
			throw new Error('Invalid email format: email must be a non-empty string');
		}

		// Trim whitespace
		email = email.trim();

		// Check if email is empty after trimming
		if (!email) {
			throw new Error('Invalid email format: email cannot be empty');
		}

		const parts = email.split('@');
		if (parts.length !== 2 || !parts[0] || !parts[1]) {
			throw new Error('Invalid email format: email must contain exactly one @ symbol with text before and after');
		}

		return parts[1].toLowerCase();
	}

	/**
	 * Find school by email domain
	 */
	public static async findSchoolByEmailDomain(email: string): Promise<School | null> {
		const domain = this.extractDomain(email);

		const schoolDomain = await SchoolDomains.findOne({
			where: { domain, isVerified: true },
			relations: ['school'],
		});

		return schoolDomain?.school || null;
	}

	/**
	 * Check if email is from staff domain (@campra or @avunite)
	 */
	public static isStaffEmail(email: string): boolean {
		try {
			const domain = this.extractDomain(email);
			return domain === 'campra.com' || domain === 'avunite.com';
		} catch (error) {
			// If extractDomain fails (invalid email format), it's not a staff email
			return false;
		}
	}

	/**
	 * Check if a school has an active subscription
	 */
	public static async hasActiveSubscription(schoolId: string): Promise<boolean> {
		const school = await Schools.findOneBy({ id: schoolId });
		if (!school) {
			return false;
		}

		// Check if school has been suspended (overrides everything)
		if (school.subscriptionStatus === 'suspended') {
			return false;
		}

		// Check billing records for active paid subscriptions
		const billing = await SchoolBillings.findOne({
			where: { schoolId },
			order: { createdAt: 'DESC' },
		});

		// If there's an active billing record (including trials and incomplete subscriptions), school has access
		// 'incomplete' is allowed to let students register while payment setup is in progress
		if (billing?.status === 'active' || billing?.status === 'trialing' || billing?.status === 'incomplete') {
			return true;
		}

		// Check for admin override (free access) - but only if no paid subscription exists
		const hasAdminOverride = (school.metadata?.adminOverride || school.metadata?.freeActivation) &&
			!school.metadata?.paidSubscriptionDespiteFree;

		// Schools with admin override and active/pending status have access
		// "pending" is allowed here to let school admins set up billing
		if (hasAdminOverride && ['active', 'pending'].includes(school.subscriptionStatus)) {
			return true;
		}

		// Allow pending schools that are in the process of setting up billing
		// This ensures school admins can access the system to make payments
		if (school.subscriptionStatus === 'pending') {
			return true;
		}

		return false;
	}

	/**
	 * Get student count for billing (excludes school staff, teachers, and alumni)
	 */
	public static async getStudentCount(schoolId: string): Promise<number> {
		return await Users.count({
			where: {
				schoolId,
				enrollmentStatus: 'active',
				isAlumni: false,
				isSchoolAdmin: false, // Exclude school staff/admins from billing count
				isTeacher: false, // Exclude teachers from billing count
				billingExempt: false,
			},
		});
	}

	/**
	 * Validate if registration is allowed for an email
	 */
	public static async validateRegistrationEligibility(email: string): Promise<{
		allowed: boolean;
		reason?: string;
		school?: School;
	}> {
		// Staff emails always allowed
		if (this.isStaffEmail(email)) {
			return { allowed: true };
		}

		// Find school by domain
		const school = await this.findSchoolByEmailDomain(email);
		if (!school) {
			return {
				allowed: false,
				reason: 'SCHOOL_NOT_REGISTERED',
			};
		}

		// Check school registration settings first
		if (!school.registrationSettings?.allowDomainSignups) {
			// If domain signups are disabled, check whitelist
			if (school.registrationSettings?.requireInvitation) {
				const { EmailWhitelists } = await import('@/models/index.js');
				const whitelistEntry = await EmailWhitelists.findOne({
					where: {
						schoolId: school.id,
						email: email.toLowerCase(),
					},
				});

				if (!whitelistEntry) {
					return {
						allowed: false,
						reason: 'EMAIL_NOT_WHITELISTED',
						school,
					};
				}

				// Email is whitelisted, continue with other checks
			} else {
				return {
					allowed: false,
					reason: 'SCHOOL_REGISTRATION_CLOSED',
					school,
				};
			}
		}


		// Check if school has active subscription
		const hasSubscription = await this.hasActiveSubscription(school.id);
		if (!hasSubscription) {
			return {
				allowed: false,
				reason: 'SCHOOL_SUBSCRIPTION_REQUIRED',
				school,
			};
		}

		// Check student cap limits
		if (school.studentCapEnforced && school.studentCap !== null) {
			const currentCount = await this.getStudentCount(school.id);
			if (currentCount >= school.studentCap) {
				return {
					allowed: false,
					reason: 'STUDENT_CAP_REACHED',
					school,
				};
			}
		}

		// Check LMS validation if required
		if (school.registrationSettings?.requireLMSValidation) {
			try {
				const { LMSService } = await import('./lms-service.js');

				// Verify LMS is configured and connected
				if (!school.metadata?.lms || school.metadata.lms.connectionStatus !== 'active') {
					logger.warn(`LMS validation required for school ${school.id} but LMS not configured or not active`);
					return {
						allowed: false,
						reason: 'LMS_NOT_CONFIGURED',
						school,
					};
				}

				// Validate student email exists in LMS (call static method directly)
				const isValid = await LMSService.validateStudentEmail(school.id, email);
				if (!isValid) {
					logger.info(`LMS validation failed for email ${email} at school ${school.id}`);
					return {
						allowed: false,
						reason: 'LMS_VALIDATION_FAILED',
						school,
					};
				}

				logger.info(`LMS validation passed for email ${email} at school ${school.id}`);
			} catch (error: any) {
				logger.error(`LMS validation error for ${email} at school ${school.id}:`, error);
				// Fail closed - if LMS validation fails, block registration
				return {
					allowed: false,
					reason: 'LMS_VALIDATION_FAILED',
					school,
				};
			}
		}

		return {
			allowed: true,
			school,
		};
	}

	/**
	 * Get school by ID
	 */
	public static async getSchoolById(id: string): Promise<School | null> {
		return await Schools.findOneBy({ id });
	}

	/**
	 * Create a new school (platform admin only)
	 */
	public static async createSchool(data: {
		name: string;
		domain: string;
		type: string;
		location?: string;
		description?: string;
		logoUrl?: string;
		websiteUrl?: string;
	}): Promise<School> {
		const now = new Date();
		const school = new School({
			id: genId(),
			createdAt: now,
			updatedAt: now,
			...data,
			domain: data.domain.toLowerCase(),
		});

		const savedSchool = await Schools.save(school);

		// Create the primary domain entry
		const schoolDomain = new SchoolDomain({
			id: genId(),
			createdAt: now,
			schoolId: savedSchool.id,
			domain: data.domain.toLowerCase(),
			isVerified: true, // Platform admin verified
			verificationMethod: 'platform_admin',
			verifiedAt: new Date(),
		});

		await SchoolDomains.save(schoolDomain);

		return savedSchool;
	}

	/**
	 * Create initial school billing record
	 */
	public static async createInitialBilling(schoolId: string): Promise<SchoolBilling> {
		const now = new Date();
		const billing = new SchoolBilling({
			id: genId(),
			createdAt: now,
			updatedAt: now,
			schoolId,
			billingCycle: 'monthly',
			status: 'pending',
			currentPeriodStart: new Date(),
			currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
			studentCount: 0,
			pricePerStudent: 15.00, // Default $15.00 per student per year
			totalAmount: 0,
			currency: 'USD',
		});

		return await SchoolBillings.save(billing);
	}

	/**
	 * Add additional domain to school
	 */
	public static async addSchoolDomain(schoolId: string, domain: string): Promise<SchoolDomain> {
		const schoolDomain = new SchoolDomain({
			schoolId,
			domain: domain.toLowerCase(),
			isVerified: false,
			verificationMethod: 'dns',
		});

		return await SchoolDomains.save(schoolDomain);
	}

	/**
	 * Update student count and billing
	 */
	public static async updateStudentCountAndBilling(schoolId: string): Promise<void> {
		const studentCount = await this.getStudentCount(schoolId);

		const billing = await SchoolBillings.findOne({
			where: { schoolId },
			order: { createdAt: 'DESC' },
		});

		if (billing) {
			billing.studentCount = studentCount;
			billing.totalAmount = studentCount * billing.pricePerStudent;
			await SchoolBillings.save(billing);
		}

		// Update Stripe subscription with new student count
		// This will automatically charge first-year schools for new students
		try {
			const stripeManager = await StripeSchoolManager.initialize();
			await stripeManager.updateSchoolSubscription(schoolId);
		} catch (error: any) {
			// Log error but don't block user registration
			logger.error(`Failed to update Stripe subscription for school ${schoolId}: ${error.message}`);
		}
	}

	/**
	 * Create school with admin email verification (enhanced school creation)
	 */
	public static async createSchoolWithAdmin(data: {
		name: string;
		domain: string;
		type: string;
		location?: string;
		description?: string;
		logoUrl?: string;
		websiteUrl?: string;
		coordinates?: { latitude: number; longitude: number };
		adminEmail: string;
		adminName: string;
	}): Promise<{ school: School; verificationSent: boolean }> {
		// Create the school first
		const school = await this.createSchool({
			name: data.name,
			domain: data.domain,
			type: data.type,
			location: data.location,
			description: data.description,
			logoUrl: data.logoUrl,
			websiteUrl: data.websiteUrl,
		});

		// Update school with coordinates if provided
		if (data.coordinates) {
			await Schools.update(school.id, {
				coordinates: this.formatCoordinatesForDB(data.coordinates) as any,
			});
		}

		// Send admin verification email
		let verificationSent = false;
		try {
			await EmailVerificationService.sendSchoolAdminVerification(
				data.adminEmail,
				school.id,
				school.name
			);
			verificationSent = true;
			logger.info(`School admin verification email sent to ${data.adminEmail} for school ${school.id}`);
		} catch (error: any) {
			logger.error(`Failed to send school admin verification email: ${error.message}`);
			// Don't throw error - school creation should succeed even if email fails
		}

		return { school, verificationSent };
	}

	/**
	 * Create teacher account
	 */
	public static async createTeacherAccount(
		schoolId: string,
		teacherData: {
			email: string;
			name: string;
			sendInvitation?: boolean;
		}
	): Promise<{ user: User; tempPassword?: string }> {
		const school = await Schools.findOneBy({ id: schoolId });
		if (!school) {
			throw new Error('School not found');
		}

		// Check if email is already taken
		const existingProfile = await UserProfiles.findOne({
			where: { email: teacherData.email.toLowerCase() },
		});

		if (existingProfile) {
			throw new Error('Email address is already in use');
		}

		// Create new teacher account
		const userId = genId();
		const now = new Date();
		const tempPassword = secureRndstr(12, true);
		const hashedPassword = await bcrypt.hash(tempPassword, 10);

		// Generate unique username
		const baseUsername = teacherData.email.split('@')[0];
		let username = baseUsername;
		let counter = 1;

		while (await Users.findOne({ where: { usernameLower: username.toLowerCase() } })) {
			username = `${baseUsername}${counter}`;
			counter++;
		}

		const user = await Users.save({
			id: userId,
			createdAt: now,
			username,
			usernameLower: username.toLowerCase(),
			name: teacherData.name,
			isSchoolAdmin: false, // Teachers are NOT school admins
			isTeacher: true, // Mark as teacher
			schoolId,
			enrollmentStatus: 'active',
			isAlumni: false,
			billingExempt: true, // Teachers are exempt from billing
		});

		// Create user profile
		await UserProfiles.save({
			userId: user.id,
			email: teacherData.email.toLowerCase(),
			emailVerified: false,
			password: hashedPassword,
		});

		logger.info(`Teacher account created for ${teacherData.email} at school ${schoolId}`);

		return { user, tempPassword };
	}

	/**
	 * Process graduations for students with graduation dates that have passed
	 */
	public static async processGraduations(schoolId: string): Promise<{
		processedCount: number;
		graduatedStudents: string[];
	}> {
		const school = await Schools.findOneBy({ id: schoolId });
		if (!school) {
			throw new Error('School not found');
		}

		// Check if auto graduation is enabled
		if (!school.registrationSettings?.autoGraduationEnabled) {
			logger.info(`Auto graduation is disabled for school ${schoolId}`);
			return { processedCount: 0, graduatedStudents: [] };
		}

		const now = new Date();

		// Find students with graduation dates that have passed
		const studentsToGraduate = await Users.find({
			where: {
				schoolId,
				enrollmentStatus: 'active',
				isAlumni: false,
				graduationDate: now, // Less than or equal to now
			},
		});

		const graduatedStudents: string[] = [];
		let processedCount = 0;

		for (const student of studentsToGraduate) {
			try {
				// Calculate grace period end date (30 days from graduation)
				const gracePeriodEndsAt = new Date(now);
				gracePeriodEndsAt.setDate(gracePeriodEndsAt.getDate() + 30);

				// Create graduated student record
				const graduatedStudent = new GraduatedStudent({
					id: genId(),
					userId: student.id,
					schoolId: student.schoolId!,
					graduationDate: student.graduationDate || now,
					createdAt: now,
					gracePeriodEndsAt: gracePeriodEndsAt,
					notifiedAboutDeletion: false,
				});

				await GraduatedStudents.save(graduatedStudent);

				// Update user status
				await Users.update(student.id, {
					isAlumni: true,
					enrollmentStatus: 'graduated',
				});

				graduatedStudents.push(student.id);
				processedCount++;

				logger.info(`Graduated student ${student.id} from school ${schoolId}. Grace period ends: ${gracePeriodEndsAt.toISOString()}`);
			} catch (error: any) {
				logger.error(`Failed to graduate student ${student.id}: ${error.message}`);
			}
		}

		// Update billing if students were graduated
		if (processedCount > 0) {
			await this.updateStudentCountAndBilling(schoolId);
		}

		logger.info(`Processed ${processedCount} graduations for school ${schoolId}`);
		return { processedCount, graduatedStudents };
	}

	/**
	 * Update school settings
	 */
	public static async updateSchoolSettings(
		schoolId: string,
		settings: {
			registrationSettings?: {
				allowDomainSignups?: boolean;
				requireInvitation?: boolean;
				autoGraduationEnabled?: boolean;
			};
			location?: string;
			coordinates?: { latitude: number; longitude: number };
		}
	): Promise<School> {
		const school = await Schools.findOneBy({ id: schoolId });
		if (!school) {
			throw new Error('School not found');
		}

		const updateData: Partial<School> = {};

		// Update registration settings
		if (settings.registrationSettings) {
			updateData.registrationSettings = {
				...school.registrationSettings,
				...settings.registrationSettings,
			};
		}

		// Update location
		if (settings.location !== undefined) {
			updateData.location = settings.location;
		}

		// Update coordinates
		if (settings.coordinates) {
			updateData.coordinates = this.formatCoordinatesForDB(settings.coordinates) as any;
		}

		// Update the school
		await Schools.update(schoolId, updateData);

		const updatedSchool = await Schools.findOneByOrFail({ id: schoolId });

		logger.info(`Updated settings for school ${schoolId}`);
		return updatedSchool;
	}

	/**
	 * Get school admin users
	 */
	public static async getSchoolAdmins(schoolId: string): Promise<User[]> {
		return await Users.find({
			where: {
				schoolId,
				isSchoolAdmin: true,
				enrollmentStatus: 'active',
			},
		});
	}

	/**
	 * Get school teachers (non-admin school staff)
	 */
	public static async getSchoolTeachers(schoolId: string): Promise<User[]> {
		return await Users.find({
			where: {
				schoolId,
				isSchoolAdmin: true,
				enrollmentStatus: 'active',
			},
		});
	}

	/**
	 * Get school students
	 */
	public static async getSchoolStudents(schoolId: string, includeAlumni: boolean = false): Promise<User[]> {
		const whereCondition: any = {
			schoolId,
			isSchoolAdmin: false,
		};

		if (!includeAlumni) {
			whereCondition.isAlumni = false;
			whereCondition.enrollmentStatus = 'active';
		}

		return await Users.find({
			where: whereCondition,
			order: { createdAt: 'DESC' },
		});
	}

	/**
	 * Convert student to teacher
	 */
	public static async convertStudentToTeacher(userId: string): Promise<User> {
		const user = await Users.findOneBy({ id: userId });
		if (!user) {
			throw new Error('User not found');
		}

		if (user.isSchoolAdmin) {
			throw new Error('User is already a teacher/admin');
		}

		await Users.update(userId, {
			isSchoolAdmin: true,
			billingExempt: true,
		});

		const updatedUser = await Users.findOneByOrFail({ id: userId });

		// Update billing since teacher is now exempt
		if (user.schoolId) {
			await this.updateStudentCountAndBilling(user.schoolId);
		}

		logger.info(`Converted student ${userId} to teacher`);
		return updatedUser;
	}

	/**
	 * Convert teacher to student
	 */
	public static async convertTeacherToStudent(userId: string): Promise<User> {
		const user = await Users.findOneBy({ id: userId });
		if (!user) {
			throw new Error('User not found');
		}

		if (!user.isSchoolAdmin) {
			throw new Error('User is not a teacher/admin');
		}

		await Users.update(userId, {
			isSchoolAdmin: false,
			billingExempt: false,
		});

		const updatedUser = await Users.findOneByOrFail({ id: userId });

		// Update billing since student is now counted
		if (user.schoolId) {
			await this.updateStudentCountAndBilling(user.schoolId);
		}

		logger.info(`Converted teacher ${userId} to student`);
		return updatedUser;
	}

	/**
	 * Delete a school and all associated data (students, staff, billing, etc.)
	 */
	public static async deleteSchool(
		schoolId: string,
		deletedBy: string,
		reason: string
	): Promise<{
		success: boolean;
		deletedCounts: {
			students: number;
			staff: number;
			stripeCustomers: number;
			verifications: number;
			csvLogs: number;
		};
	}> {
		const school = await Schools.findOneBy({ id: schoolId });
		if (!school) {
			throw new Error('School not found');
		}

		// Get counts of what will be deleted for logging
		const studentCount = await Users.countBy({ schoolId });
		const staffCount = await Users.countBy({ adminForSchoolId: schoolId });
		const stripeCustomerCount = await StripeCustomers.countBy({ schoolId });
		const verificationCount = await SchoolAdminVerifications.countBy({ schoolId });
		const csvLogCount = await CSVImportLogs.countBy({ schoolId });

		logger.info(`Preparing to delete school ${schoolId}: ${studentCount} students, ${staffCount} staff, ${stripeCustomerCount} stripe customers, ${verificationCount} verifications, ${csvLogCount} CSV logs`);

		// Delete all school students (users with schoolId)
		if (studentCount > 0) {
			await Users.delete({ schoolId });
			logger.info(`Deleted ${studentCount} students belonging to school ${schoolId}`);
		}

		// Delete all school staff (users with adminForSchoolId)
		if (staffCount > 0) {
			await Users.delete({ adminForSchoolId: schoolId });
			logger.info(`Deleted ${staffCount} staff members for school ${schoolId}`);
		}

		// Delete Stripe customers associated with the school
		if (stripeCustomerCount > 0) {
			await StripeCustomers.delete({ schoolId });
			logger.info(`Deleted ${stripeCustomerCount} Stripe customers for school ${schoolId}`);
		}

		// Delete school admin verifications
		if (verificationCount > 0) {
			await SchoolAdminVerifications.delete({ schoolId });
			logger.info(`Deleted ${verificationCount} admin verifications for school ${schoolId}`);
		}

		// Delete CSV import logs
		if (csvLogCount > 0) {
			await CSVImportLogs.delete({ schoolId });
			logger.info(`Deleted ${csvLogCount} CSV import logs for school ${schoolId}`);
		}

		// Store deletion metadata
		await Schools.update({ id: schoolId }, {
			metadata: {
				...school.metadata,
				deletion: {
					deleted_at: new Date().toISOString(),
					deleted_by: deletedBy,
					reason: reason,
					deleted_counts: {
						students: studentCount,
						staff: staffCount,
						stripe_customers: stripeCustomerCount,
						verifications: verificationCount,
						csv_logs: csvLogCount
					}
				}
			}
		});

		// Delete the school (this will cascade delete SchoolDomains, CampusBlocks, SchoolBillings, GraduatedStudents)
		await Schools.delete({ id: schoolId });

		logger.info(`School ${schoolId} deleted by ${deletedBy}. Reason: ${reason}`);

		return {
			success: true,
			deletedCounts: {
				students: studentCount,
				staff: staffCount,
				stripeCustomers: stripeCustomerCount,
				verifications: verificationCount,
				csvLogs: csvLogCount
			}
		};
	}
}
