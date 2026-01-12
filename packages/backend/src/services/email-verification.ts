import { SchoolAdminVerifications, Users, UserProfiles, Schools } from '@/models/index.js';
import { SchoolAdminVerification } from '@/models/entities/school-admin-verification.js';
import { genId } from '@/misc/gen-id.js';
import { secureRndstr } from '@/misc/secure-rndstr.js';
import { sendEmail } from './send-email.js';
import config from '@/config/index.js';
import Logger from './logger.js';
import bcrypt from 'bcryptjs';

const logger = new Logger('email-verification');

/**
 * Email verification service for school admin accounts
 */
export class EmailVerificationService {
	/**
	 * Send verification email to school admin with temporary password
	 */
	public static async sendSchoolAdminVerification(
		email: string,
		schoolId: string,
		schoolName: string
	): Promise<void> {
		// Generate temporary password (8 characters, alphanumeric)
		const tempPassword = secureRndstr(8, false);
		const hashedPassword = await bcrypt.hash(tempPassword, 8);
		const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

		// Check if user already exists
		const existingProfile = await UserProfiles.findOne({
			where: { email: email.toLowerCase() },
		});
		
		let user = null;
		if (existingProfile) {
			user = await Users.findOne({
				where: { id: existingProfile.userId },
			});
		}

		if (user) {
			// Update existing user to be school admin with temporary password
			await Users.update(user.id, {
				isSchoolAdmin: true,
				schoolId: schoolId,
				mustChangePassword: true,
			});

			// Update user profile with temporary password
			await UserProfiles.update(
				{ userId: user.id },
				{
					emailVerified: true,
					emailVerifyCode: null,
					password: hashedPassword,
				}
			);
		} else {
			// Create new user account with temporary password
			const userId = genId();
			const now = new Date();

			const baseUsername = email.split('@')[0];
			let username = baseUsername;
			let counter = 1;
			
			// Ensure username is unique
			while (await Users.findOne({ where: { usernameLower: username.toLowerCase() } })) {
				username = `${baseUsername}${counter}`;
				counter++;
			}

			user = await Users.save({
				id: userId,
				createdAt: now,
				username,
				usernameLower: username.toLowerCase(),
				name: 'School Administrator',
				isSchoolAdmin: true,
				schoolId: schoolId,
				enrollmentStatus: 'active',
				isAlumni: false,
				billingExempt: true, // School admins are exempt from billing
				mustChangePassword: true, // Must change password on first login
			});

			// Create user profile with temporary password
			await UserProfiles.save({
				userId: user.id,
				email: email.toLowerCase(),
				emailVerified: true,
				password: hashedPassword,
			});
		}

		// Create verification record for tracking
		const verification = new SchoolAdminVerification({
			id: genId(),
			schoolId,
			email: email.toLowerCase(),
			token: secureRndstr(64, true), // Keep token for tracking but not used in login
			expiresAt,
			verified: true, // Mark as verified since we're creating the account directly
			createdAt: new Date(),
		});

		await SchoolAdminVerifications.save(verification);

		// Send welcome email with temporary password
		const loginUrl = `${config.url}/`;
		const subject = `Welcome to ${schoolName} on Campra - Your temporary login credentials`;
		
		const html = `
			<p>Hello,</p>
			<p>You have been set up as a school administrator for <strong>${schoolName}</strong> on Campra.</p>
			<p>Your account has been created with the following temporary credentials:</p>
			
			<div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 20px 0; font-family: monospace;">
				<p><strong>Username:</strong> ${user.username}</p>
				<p><strong>Temporary Password:</strong> ${tempPassword}</p>
			</div>
			
			<p><strong>Important:</strong> For security reasons, you will be required to change your password when you first log in.</p>
			
			<p>To log in, click the button below or visit the login page:</p>
			<p><a href="${loginUrl}" style="background: #e84d83; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Log In to Campra</a></p>
			
			<p>Or visit: <a href="${loginUrl}">${loginUrl}</a></p>
			
			<p>If you did not expect this email, please contact support@avunite.com</p>
			<p>Welcome to Campra!</p>
		`;

		const text = `
Hello,

You have been set up as a school administrator for ${schoolName} on Campra.

Your account has been created with the following temporary credentials:

Username: ${user.username}
Temporary Password: ${tempPassword}

IMPORTANT: For security reasons, you will be required to change your password when you first log in.

To log in, visit: ${loginUrl}

If you did not expect this email, please contact support@avunite.com

Welcome to Campra!
		`;

		await sendEmail(email, subject, html, text);
		logger.info(`School admin credentials sent to ${email} for school ${schoolId}`);
	}

	/**
	 * Get all school admin accounts with temporary passwords older than specified days
	 */
	public static async getAdminsWithTempPasswords(olderThanDays: number = 7): Promise<any[]> {
		const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
		
		const users = await Users.find({
			where: {
				isSchoolAdmin: true,
				mustChangePassword: true,
				createdAt: cutoffDate, // Less than cutoff date (older than X days)
			},
			relations: ['profile'],
		});

		return users;
	}	/**
	 * Send reminder email for school admin to use their temporary credentials
	 */
	public static async sendReminderEmail(email: string, schoolId: string): Promise<void> {
		const school = await Schools.findOneBy({ id: schoolId });
		if (!school) {
			throw new Error('School not found');
		}

		// Check if user exists
		const existingProfile = await UserProfiles.findOne({
			where: { email: email.toLowerCase() },
		});
		
		if (!existingProfile) {
			throw new Error('No user account found for this email');
		}

		const user = await Users.findOne({
			where: { id: existingProfile.userId },
		});

		if (!user || !user.isSchoolAdmin || !user.mustChangePassword) {
			throw new Error('User is not a school admin or does not need password change');
		}

		// Send reminder email
		const loginUrl = `${config.url}/`;
		const subject = `Reminder: Log in to your ${school.name} Campra account`;
		
		const html = `
			<p>Hello,</p>
			<p>This is a reminder that you have a school administrator account for <strong>${school.name}</strong> on Campra.</p>
			<p>You can log in using your username: <strong>${user.username}</strong></p>
			<p>If you've forgotten your temporary password, please contact support@avunite.com.</p>
			<p><strong>Remember:</strong> You will need to change your password when you first log in.</p>
			<p>To log in, click the button below:</p>
			<p><a href="${loginUrl}" style="background: #e84d83; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Log In to Campra</a></p>
			<p>Or visit: <a href="${loginUrl}">${loginUrl}</a></p>
			<p>If you did not expect this email, please contact support@avunite.com.</p>
		`;

		const text = `
Hello,

This is a reminder that you have a school administrator account for ${school.name} on Campra.

You can log in using your username: ${user.username}

If you've forgotten your temporary password, please contact support@avunite.com

Remember: You will need to change your password when you first log in.

To log in, visit: ${loginUrl}

If you did not expect this email, please contact support@avunite.com
		`;

		await sendEmail(email, subject, html, text);
		logger.info(`School admin reminder email sent to ${email} for school ${schoolId}`);
	}

	/**
	 * Get all unverified admin accounts older than specified days
	 */
	public static async getUnverifiedAdmins(olderThanDays: number = 7): Promise<SchoolAdminVerification[]> {
		const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
		
		return await SchoolAdminVerifications.find({
			where: {
				verified: false,
				createdAt: cutoffDate,
			},
			relations: ['school'],
		});
	}

	/**
	 * Clean up expired verification tokens
	 */
	public static async cleanupExpiredTokens(): Promise<number> {
		const result = await SchoolAdminVerifications.delete({
			verified: false,
			expiresAt: new Date(), // Less than current time
		});

		const deletedCount = result.affected || 0;
		if (deletedCount > 0) {
			logger.info(`Cleaned up ${deletedCount} expired verification tokens`);
		}

		return deletedCount;
	}

	/**
	 * Generate new verification token for existing record
	 */
	public static async regenerateToken(verificationId: string): Promise<string> {
		const token = secureRndstr(64, true);
		const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

		await SchoolAdminVerifications.update(verificationId, {
			token,
			expiresAt,
		});

		return token;
	}
}