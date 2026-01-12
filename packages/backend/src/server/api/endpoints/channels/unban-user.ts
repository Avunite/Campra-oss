import define from '../../define.js';
import { ApiError } from '../../error.js';
import { Channels, Users } from '@/models/index.js';

export const meta = {
  tags: ['channels', 'users'],
  requireCredential: true,
  kind: 'write:channels',
  errors: {
    noSuchChannel: {
      message: 'No such channel.',
      code: 'NO_SUCH_CHANNEL',
      id: 'eb574755-5f2f-4221-9455-448a72be12f3',
    },
    noSuchUser: {
      message: 'No such user.',
      code: 'NO_SUCH_USER',
      id: '7ad3fa3e-98a0-4e9c-a1c7-23197c18f9be',
    },
    accessDenied: {
      message: 'You do not have permission to unban users from this channel.',
      code: 'ACCESS_DENIED',
      id: 'fe8d7103-0ea8-4d3c-b17e-f685e5459d51',
    },
    userNotBanned: {
      message: 'This user is not banned from the channel.',
      code: 'USER_NOT_BANNED',
      id: '98c11aea-d4c6-4ad5-b4de-97f0f6ce63d7',
    },
  },
};

export const paramDef = {
  type: 'object',
  properties: {
    channelId: { type: 'string', format: 'campra:id' },
    userId: { type: 'string', format: 'campra:id' },
  },
  required: ['channelId', 'userId'],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps, me) => {
  // Fetch the channel
  const channel = await Channels.findOneBy({ id: ps.channelId });
  if (channel == null) {
    throw new ApiError(meta.errors.noSuchChannel);
  }

  // Fetch the user to be unbanned
  const user = await Users.findOneBy({ id: ps.userId });
  if (user == null) {
    throw new ApiError(meta.errors.noSuchUser);
  }

  // Check if the current user has permission to unban users from this channel
  const isOwner = channel.userId === me.id;
  const isAdmin = channel.admins && channel.admins.some(admin => admin.id === me.id);
  if (!isOwner && !isAdmin) {
    throw new ApiError(meta.errors.accessDenied);
  }

  // Check if the user is actually banned
  if (!channel.banned || !channel.banned.some(bannedUser => bannedUser.id === user.id)) {
    throw new ApiError(meta.errors.userNotBanned);
  }

  // Remove the user from the banned list
  channel.banned = channel.banned.filter(bannedUser => bannedUser.id !== user.id);

  // Save the updated channel
  await Channels.save(channel);

  return {
    message: 'User has been unbanned from the channel.',
  };
});