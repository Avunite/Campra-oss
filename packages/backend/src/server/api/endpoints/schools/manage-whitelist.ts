import define from '../../define.js';
import { EmailWhitelists, Schools } from '@/models/index.js';
import { EmailWhitelist } from '@/models/entities/email-whitelist.js';
import { genId } from '@/misc/gen-id.js';
import { sendEmail } from '@/services/send-email.js';
import config from '@/config/index.js';
import Logger from '@/services/logger.js';

const logger = new Logger('whitelist-management');

export const meta = {
	tags: ['schools'],
	requireCredential: true,
	
	description: 'Manage email whitelist for school (school admin only)',

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
			whitelist: {
				type: 'object',
				optional: true,
				nullable: true,
			},
			message: {
				type: 'string',
				optional: true,
				nullable: true,
			},
		},
	},

	errors: {
		accessDenied: {
			message: 'Access denied: School admin access required',
			code: 'ACCESS_DENIED',
			id: 'whitelist-001',
		},
		invalidEmail: {
			message: 'Invalid email format',
			code: 'INVALID_EMAIL',
			id: 'whitelist-002',
		},
		emailExists: {
			message: 'Email already whitelisted',
			code: 'EMAIL_EXISTS',
			id: 'whitelist-003',
		},
		notFound: {
			message: 'Whitelist entry not found',
			code: 'NOT_FOUND',
			id: 'whitelist-004',
		},
		wrongDomain: {
			message: 'Email must be from your school domain',
			code: 'WRONG_DOMAIN',
			id: 'whitelist-005',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		action: { 
			type: 'string',
			enum: ['add', 'remove', 'list', 'send-invitation'],
		},
		email: { 
			type: 'string', 
			maxLength: 256,
		},
		name: {
			type: 'string',
			maxLength: 100,
		},
		gradeLevel: {
			type: 'string',
			maxLength: 32,
		},
		notes: {
			type: 'string',
			maxLength: 256,
		},
		whitelistId: {
			type: 'string',
			format: 'campra:id',
		},
		limit: {
			type: 'number',
			minimum: 1,
			maximum: 100,
			default: 50,
		},
		offset: {
			type: 'number',
			minimum: 0,
			default: 0,
		},
	},
	required: ['action'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Check if user is school admin
	if (!user.isSchoolAdmin || !user.adminForSchoolId) {
		throw new Error('ACCESS_DENIED');
	}

	const schoolId = user.adminForSchoolId;

	// Get school information
	const school = await Schools.findOneBy({ id: schoolId });
	if (!school) {
		throw new Error('ACCESS_DENIED');
	}

	switch (ps.action) {
		case 'add': {
			if (!ps.email) {
				throw new Error('INVALID_EMAIL');
			}

			const email = ps.email.toLowerCase().trim();
			
			// Validate email format
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(email)) {
				throw new Error('INVALID_EMAIL');
			}

			// Verify email is from school domain
			const emailDomain = email.split('@')[1];
			if (emailDomain !== school.domain.toLowerCase()) {
				throw new Error('WRONG_DOMAIN');
			}

			// Check if already whitelisted
			const existing = await EmailWhitelists.findOne({
				where: { schoolId, email },
			});

			if (existing) {
				throw new Error('EMAIL_EXISTS');
			}

			// Create whitelist entry
			const whitelist = new EmailWhitelist({
				id: genId(),
				schoolId,
				email,
				name: ps.name || null,
				gradeLevel: ps.gradeLevel || null,
				addedBy: user.id,
				notes: ps.notes || null,
				invitationSent: false,
				registered: false,
			});

			await EmailWhitelists.save(whitelist);

			logger.info(`Added ${email} to whitelist for school ${schoolId}`);

			return {
				success: true,
				whitelist: {
					id: whitelist.id,
					email: whitelist.email,
					name: whitelist.name,
					gradeLevel: whitelist.gradeLevel,
					createdAt: whitelist.createdAt,
				},
				message: `Added ${email} to whitelist`,
			};
		}

		case 'remove': {
			if (!ps.whitelistId) {
				throw new Error('NOT_FOUND');
			}

			const whitelist = await EmailWhitelists.findOne({
				where: { id: ps.whitelistId, schoolId },
			});

			if (!whitelist) {
				throw new Error('NOT_FOUND');
			}

			await EmailWhitelists.delete(ps.whitelistId);

			logger.info(`Removed ${whitelist.email} from whitelist for school ${schoolId}`);

			return {
				success: true,
				message: `Removed ${whitelist.email} from whitelist`,
			};
		}

		case 'list': {
			const [whitelists, total] = await EmailWhitelists.findAndCount({
				where: { schoolId },
				order: { createdAt: 'DESC' },
				take: ps.limit || 50,
				skip: ps.offset || 0,
			});

			return {
				success: true,
				whitelists: whitelists.map((w: EmailWhitelist) => ({
					id: w.id,
					email: w.email,
					name: w.name,
					gradeLevel: w.gradeLevel,
					invitationSent: w.invitationSent,
					invitationSentAt: w.invitationSentAt,
					registered: w.registered,
					registeredAt: w.registeredAt,
					createdAt: w.createdAt,
					notes: w.notes,
				})),
				total,
			};
		}

		case 'send-invitation': {
			if (!ps.whitelistId) {
				throw new Error('NOT_FOUND');
			}

			const whitelist = await EmailWhitelists.findOne({
				where: { id: ps.whitelistId, schoolId },
			});

			if (!whitelist) {
				throw new Error('NOT_FOUND');
			}

			if (whitelist.registered) {
				return {
					success: false,
					message: 'User has already registered',
				};
			}

			// Send invitation email
			const signupUrl = `${config.url}/signup`;
			const subject = `You're invited to join ${school.name} on Campra`;
			
			const html = `
				<p>Hello${whitelist.name ? ` ${whitelist.name}` : ''},</p>
				<p>You have been invited to join <strong>${school.name}</strong> on Campra!</p>
				<p>Campra is a social platform designed specifically for your campus community.</p>
				${whitelist.gradeLevel ? `<p>You have been pre-assigned to: <strong>${whitelist.gradeLevel}</strong></p>` : ''}
				<p><a href="${signupUrl}" style="background: #e84d83; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Sign Up Now</a></p>
				<p>Or visit: <a href="${signupUrl}">${signupUrl}</a></p>
				<p>Use this email address (${whitelist.email}) to sign up.</p>
				<p>Welcome to your campus community!</p>
			`;

			const text = `
Hello${whitelist.name ? ` ${whitelist.name}` : ''},

You have been invited to join ${school.name} on Campra!

Campra is a social platform designed specifically for your campus community.
${whitelist.gradeLevel ? `\nYou have been pre-assigned to: ${whitelist.gradeLevel}\n` : ''}
Sign up at: ${signupUrl}

Use this email address (${whitelist.email}) to sign up.

Welcome to your campus community!
			`;

			await sendEmail(whitelist.email, subject, html, text);

			// Update whitelist entry
			await EmailWhitelists.update(whitelist.id, {
				invitationSent: true,
				invitationSentAt: new Date(),
			});

			logger.info(`Sent invitation to ${whitelist.email} for school ${schoolId}`);

			return {
				success: true,
				message: `Invitation sent to ${whitelist.email}`,
			};
		}

		default:
			throw new Error('INVALID_ACTION');
	}
});
