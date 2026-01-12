import define from '../../define.js';
import { Schools, Users, UserProfiles } from '@/models/index.js';
import { User } from '@/models/entities/user.js';
import { UserProfile } from '@/models/entities/user-profile.js';
import { genId } from '@/misc/gen-id.js';
import bcrypt from 'bcryptjs';
import { secureRndstr } from '@/misc/secure-rndstr.js';
import generateUserToken from '../../common/generate-native-user-token.js';

function generateSecurePassword(): string {
	// Generate a secure random password
	return secureRndstr(12, true);
}

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
	
	description: 'Create a school administrator account',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			user: {
				type: 'object',
				optional: false,
				nullable: false,
				properties: {
					id: { type: 'string', format: 'campra:id' },
					username: { type: 'string' },
					email: { type: 'string' },
				},
			},
			verificationSent: {
				type: 'boolean',
				optional: false,
				nullable: false,
			},
			temporaryPassword: {
				type: 'string',
				optional: true,
				nullable: true,
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		schoolId: { type: 'string', format: 'campra:id' },
		email: { type: 'string', minLength: 1, maxLength: 128 },
		name: { type: 'string', minLength: 1, maxLength: 100 },
		generatePassword: { type: 'boolean', default: true },
	},
	required: ['schoolId', 'email', 'name'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Verify the school exists
	const school = await Schools.findOneBy({ id: ps.schoolId });
	if (!school) {
		throw new Error('School not found');
	}

	// Extract username from email
	const emailParts = ps.email.split('@');
	if (emailParts.length !== 2) {
		throw new Error('Invalid email format');
	}
	
	const baseUsername = emailParts[0].toLowerCase().replace(/[^a-z0-9]/g, '');
	let username = baseUsername;
	
	// Ensure username is unique
	let counter = 1;
	while (await Users.findOneBy({ usernameLower: username })) {
		username = `${baseUsername}${counter}`;
		counter++;
	}

	// Generate password if requested
	let temporaryPassword = null;
	if (ps.generatePassword) {
		temporaryPassword = generateSecurePassword();
	}

	const now = new Date();
	const userId = genId();
	const userToken = generateUserToken(); // Generate user token

	// Create the user
	const newUser = new User({
		id: userId,
		createdAt: now,
		updatedAt: now,
		username: username,
		usernameLower: username.toLowerCase(),
		name: ps.name,
		token: userToken, // Set the token for authentication
		isBot: false,
		isLocked: false,
		isExplorable: true,
		isDeleted: false,
		isAdmin: false,
		isModerator: false,
		isStaff: false,
		isSchoolAdmin: true, // Mark as school admin
		adminForSchoolId: ps.schoolId, // Assign to specific school
		schoolId: ps.schoolId,
	});

	await Users.save(newUser);

	// Create the user profile
	const hashedPassword = temporaryPassword ? await bcrypt.hash(temporaryPassword, 10) : null;
	
	const userProfile = new UserProfile({
		userId: userId,
		email: ps.email,
		emailVerified: false,
		password: hashedPassword,
	});

	await UserProfiles.save(userProfile);

	// Send verification email instead of returning temporary password
	let verificationSent = false;
	try {
		const { EmailVerificationService } = await import('@/services/email-verification.js');
		await EmailVerificationService.sendSchoolAdminVerification(
			ps.email,
			ps.schoolId,
			school.name
		);
		verificationSent = true;
	} catch (error: any) {
		console.error('Failed to send verification email:', error);
	}

	return {
		user: {
			id: newUser.id,
			username: newUser.username,
			email: ps.email,
		},
		verificationSent,
		temporaryPassword: ps.generatePassword ? temporaryPassword : null,
	};
});
