import define from '../../define.js';
import { Users, UserProfiles } from '@/models/index.js';
import { signup } from '../../common/signup.js';
import { validateEmailForAccount } from '@/services/validate-email-for-account.js';
import bcrypt from 'bcryptjs';
import { HOUR } from '@/const.js';

export const meta = {
  tags: ['account'],
  requireCredential: true,
  kind: 'write:account',
  res: {
    type: 'object',
    optional: false,
    nullable: false,
    ref: 'User',
  },
  limit: {
    duration: HOUR,
    max: 15,
  },
} as const;

export const paramDef = {
  type: 'object',
  properties: {
    altUsername: { type: 'string', pattern: '^[a-zA-Z0-9_]+$' },
    password: { type: 'string' },
  },
  required: ['altUsername', 'password'],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps, user) => {
  const profile = await UserProfiles.findOneByOrFail({ userId: user.id });

  // Verify password
  const isPasswordValid = await bcrypt.compare(ps.password, profile.password);
  if (!isPasswordValid) {
    throw new Error('Incorrect password');
  }

  // Check if email can be used for another account
  const { available } = await validateEmailForAccount(profile.email);
  if (!available) {
    throw new Error('Maximum number of accounts reached for this email');
  }

  // Check if the requested username is available
  const existingUser = await Users.findOneBy({ username: ps.altUsername });
  if (existingUser) {
    throw new Error('Username is already taken');
  }

  // Create new alt account
  const { account } = await signup({
    username: ps.altUsername,
    password: ps.password,
    host: null,
  });

  // Set email and mark as verified
  await UserProfiles.update(account.id, {
    email: profile.email,
    emailVerified: true,
  });

  // Pack and return the new account
  return await Users.pack(account, user, {
    detail: true,
    includeSecrets: true,
  });
});