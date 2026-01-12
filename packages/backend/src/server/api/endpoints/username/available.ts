import { IsNull } from 'typeorm';
import { Users } from '@/models/index.js';
import define from '../../define.js';

export const meta = {
  tags: ['users'],
  requireCredential: false,
  res: {
    type: 'object',
    optional: false, nullable: false,
    properties: {
      available: {
        type: 'boolean',
        optional: false, nullable: false,
      },
    },
  },
} as const;

export const paramDef = {
  type: 'object',
  properties: {
    username: Users.localUsernameSchema,
  },
  required: ['username'],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps) => {
  // Convert the input username to lowercase
  const lowercaseUsername = ps.username.toLowerCase();

  // Check if the username exists in the Users table
  const exist = await Users.countBy({
    host: IsNull(),
    usernameLower: lowercaseUsername,
  });

  return {
    available: exist === 0,
  };
});