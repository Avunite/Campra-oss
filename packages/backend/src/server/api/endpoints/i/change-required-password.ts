import define from '../../define.js';
import { Users, UserProfiles } from '@/models/index.js';
import { ApiError } from '../../error.js';
import bcrypt from 'bcryptjs';

export const meta = {
	tags: ['account'],
	requireCredential: true,
	secure: true,

	description: 'Change password for user who must change password on login',

	errors: {
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: '27e494ba-2ac2-48e8-893b-10d4d8c2387b',
		},

		incorrectPassword: {
			message: 'Incorrect password.',
			code: 'INCORRECT_PASSWORD',
			id: 'e54c1d7e-e7d6-4103-86b6-0a95069b4ad3',
		},

		weakPassword: {
			message: 'The password is too weak.',
			code: 'WEAK_PASSWORD',
			id: '26be30cc-b6f5-4365-af07-f7aa0ab4426a',
		},

		noPasswordChangeRequired: {
			message: 'Password change is not required.',
			code: 'NO_PASSWORD_CHANGE_REQUIRED',
			id: 'bb2df7f5-4f6f-4e1a-8f7c-ff3a7a0f7a1b',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		currentPassword: { type: 'string' },
		newPassword: { type: 'string', minLength: 8 },
	},
	required: ['currentPassword', 'newPassword'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Check if user exists and needs to change password
	const userEntity = await Users.findOneBy({ id: user.id });
	if (!userEntity) {
		throw new ApiError(meta.errors.noSuchUser);
	}

	if (!userEntity.mustChangePassword) {
		throw new ApiError(meta.errors.noPasswordChangeRequired);
	}

	// Get user profile to check current password
	const profile = await UserProfiles.findOneBy({ userId: user.id });
	if (!profile || !profile.password) {
		throw new ApiError(meta.errors.noSuchUser);
	}

	// Verify current password
	const same = await bcrypt.compare(ps.currentPassword, profile.password);
	if (!same) {
		throw new ApiError(meta.errors.incorrectPassword);
	}

	// Validate new password strength
	if (ps.newPassword.length < 8) {
		throw new ApiError(meta.errors.weakPassword);
	}

	// Additional password strength checks
	const hasLetter = /[a-zA-Z]/.test(ps.newPassword);
	const hasNumber = /\d/.test(ps.newPassword);
	if (!hasLetter || !hasNumber) {
		throw new ApiError(meta.errors.weakPassword);
	}

	// Hash new password
	const salt = await bcrypt.genSalt(8);
	const hash = await bcrypt.hash(ps.newPassword, salt);

	// Update password and clear mustChangePassword flag
	await UserProfiles.update({ userId: user.id }, {
		password: hash,
	});

	await Users.update(user.id, {
		mustChangePassword: false,
	});

	return {
		success: true,
	};
});
