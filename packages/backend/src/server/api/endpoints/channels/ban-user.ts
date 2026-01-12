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
      message: 'You do not have permission to ban users from this channel.',
      code: 'ACCESS_DENIED',
      id: 'fe8d7103-0ea8-4d3c-b17e-f685e5459d51',
    },
    cannotBanOwner: {
      message: 'Cannot ban the channel owner.',
      code: 'CANNOT_BAN_OWNER',
      id: '685f88f5-3ed5-4d9d-9bdd-887b52d5e5b1',
    },
    userAlreadyBanned: {
      message: 'This user is already banned from the channel.',
      code: 'USER_ALREADY_BANNED',
      id: '06c9f7ec-453e-4db5-9f3e-3befb45f8c6e',
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

  // Fetch the user to be banned
  const user = await Users.findOneBy({ id: ps.userId });
  if (user == null) {
    throw new ApiError(meta.errors.noSuchUser);
  }

  // Check if the current user has permission to ban users from this channel
  const isOwner = channel.userId === me.id;
  const isAdmin = channel.admins && channel.admins.some(admin => admin.id === me.id);
  if (!isOwner && !isAdmin) {
    throw new ApiError(meta.errors.accessDenied);
  }

  // Cannot ban the channel owner
  if (user.id === channel.userId) {
    throw new ApiError(meta.errors.cannotBanOwner);
  }

  // Check if the user is already banned
  if (channel.banned && channel.banned.some(bannedUser => bannedUser.id === user.id)) {
    throw new ApiError(meta.errors.userAlreadyBanned);
  }

  // Add the user to the banned list
  if (!channel.banned) {
    channel.banned = [];
  }
  channel.banned.push({ id: user.id });

  // If the banned user was a moderator or admin, remove them from those roles
  if (channel.moderators) {
    channel.moderators = channel.moderators.filter(mod => mod.id !== user.id);
  }
  if (channel.admins) {
    channel.admins = channel.admins.filter(admin => admin.id !== user.id);
  }

  // Save the updated channel
  await Channels.save(channel);

  return {
    message: 'User has been banned from the channel.',
  };
});