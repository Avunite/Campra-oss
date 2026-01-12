import define from '../../define.js';
import { SchoolService } from '@/services/school-service.js';
import { sendEmail } from '@/services/send-email.js';
import config from '@/config/index.js';
import Logger from '@/services/logger.js';

const logger = new Logger('create-teacher');

export const meta = {
	tags: ['schools'],
	requireCredential: true,
	
	description: 'Create teacher account (school admin only)',

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
			teacher: {
				type: 'object',
				optional: false,
				nullable: false,
				properties: {
					id: {
						type: 'string',
						optional: false,
						nullable: false,
						format: 'campra:id',
					},
					username: {
						type: 'string',
						optional: false,
						nullable: false,
					},
					name: {
						type: 'string',
						optional: false,
						nullable: false,
					},
					email: {
						type: 'string',
						optional: false,
						nullable: false,
					},
					isSchoolAdmin: {
						type: 'boolean',
						optional: false,
						nullable: false,
					},
					isTeacher: {
						type: 'boolean',
						optional: false,
						nullable: false,
					},
					schoolId: {
						type: 'string',
						optional: false,
						nullable: false,
						format: 'campra:id',
					},
					createdAt: {
						type: 'string',
						optional: false,
						nullable: false,
						format: 'date-time',
					},
				},
			},
			invitationSent: {
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
			id: 'school-admin-021',
		},
		invalidEmail: {
			message: 'Invalid email format',
			code: 'INVALID_EMAIL',
			id: 'school-admin-022',
		},
		schoolNotFound: {
			message: 'School not found',
			code: 'SCHOOL_NOT_FOUND',
			id: 'school-admin-023',
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
			minLength: 1,
			maxLength: 100,
		},
		sendInvitation: { 
			type: 'boolean', 
			default: true,
		},
	},
	required: ['email', 'name'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Check if user is school admin
	if (!user.isSchoolAdmin || !user.adminForSchoolId) {
		throw new Error('ACCESS_DENIED');
	}

	const schoolId = user.adminForSchoolId;

	// Validate email format (additional validation beyond JSON schema)
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(ps.email)) {
		throw new Error('INVALID_EMAIL');
	}

	try {
		// Create teacher account
		const { user: teacher, tempPassword } = await SchoolService.createTeacherAccount(
			schoolId,
			{
				email: ps.email,
				name: ps.name,
				sendInvitation: ps.sendInvitation,
			}
		);

		let invitationSent = false;

		// Send invitation email if requested and we have a temp password (new account)
		if (ps.sendInvitation && tempPassword) {
			try {
				const loginUrl = `${config.url}`;
				const subject = `Welcome to Campra - Teacher Account Created`;
				
				// Extract username from email (part before @)
				const username = ps.email.split('@')[0];
				
				const html = `
					<p>Hello ${ps.name},</p>
					<p>A teacher account has been created for you on Campra.</p>
					<p><strong>Login Details:</strong></p>
					<div style="background: #f5f5f5; padding: 16px; border-radius: 6px; margin: 16px 0;">
						<p><strong>Username:</strong> <code style="background: #e0e0e0; padding: 2px 6px; border-radius: 3px;">${username}</code></p>
						<p><strong>Temporary Password:</strong> <code style="background: #e0e0e0; padding: 2px 6px; border-radius: 3px;">${tempPassword}</code></p>
					</div>
					<p><strong>Important:</strong></p>
					<ul>
						<li>Use your <strong>username</strong> (not email) to log in</li>
						<li>Please change your password after your first login for security</li>
					</ul>
					<p><a href="${loginUrl}" style="background: #e84d83; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Log In to Campra</a></p>
					<p>Or visit: <a href="${loginUrl}">${loginUrl}</a></p>
					<p>Welcome to the team!</p>
				`;

				const text = `
Hello ${ps.name},

A teacher account has been created for you on Campra.

Login Details:
Username: ${username}
Temporary Password: ${tempPassword}

Important:
- Use your username (not email) to log in
- Please change your password after your first login for security

Sign in at: ${loginUrl}

Welcome to the team!
				`;

				await sendEmail(ps.email, subject, html, text);
				invitationSent = true;
			} catch (emailError: any) {
				logger.error('Failed to send teacher invitation email:', emailError);
				// Don't throw error - account creation should succeed even if email fails
			}
		}

		return {
			success: true,
			teacher: {
				id: teacher.id,
				username: teacher.username,
				name: teacher.name || ps.name, // Fallback to provided name if null
				email: ps.email, // Use the provided email since it's not stored in User entity
				isSchoolAdmin: teacher.isSchoolAdmin,
				isTeacher: teacher.isTeacher,
				schoolId: teacher.schoolId || schoolId, // Ensure schoolId is not null
				createdAt: teacher.createdAt.toISOString(),
			},
			invitationSent,
		};
	} catch (error: any) {
		if (error.message === 'School not found') {
			throw new Error('SCHOOL_NOT_FOUND');
		}
		
		// Re-throw other errors
		throw error;
	}
});