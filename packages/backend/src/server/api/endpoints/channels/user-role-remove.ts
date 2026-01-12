import define from '../../define.js';
import { ApiError } from '../../error.js';
import { Users, Channels } from '@/models/index.js';

export const meta = {
  tags: ['admin', 'channels'],
  requireCredential: true,
  kind: 'write:channels',
  errors: {
    noSuchUser: {
      message: 'No such user.',
      code: 'NO_SUCH_USER',
      id: '762d58b8-4b87-4184-9785-167f926b61a8',
    },
    noSuchChannel: {
      message: 'No such channel.',
      code: 'NO_SUCH_CHANNEL',
      id: '24a5ad74-4c21-4ecc-9eaa-f6c9ad3f0319',
    },
    accessDenied: {
      message: 'You do not have permission to modify roles in this channel.',
      code: 'ACCESS_DENIED',
      id: 'fe8d7103-0ea8-4d3c-b17e-f685e5459d51',
    },
    userLacksRole: {
      message: 'User does not have this role in the channel.',
      code: 'USER_LACKS_ROLE',
      id: '7763f0b8-3e48-4a65-aafa-38c1a2f05458',
    },
    cannotRemoveOwner: {
      message: 'Cannot remove role from channel owner.',
      code: 'CANNOT_REMOVE_OWNER',
      id: '3fb11535-ac90-4b7c-adde-769a37774149',
    },
  },
};

export const paramDef = {
  type: 'object',
  properties: {
    userId: { type: 'string', format: 'campra:id' },
    channelId: { type: 'string', format: 'campra:id' },
    role: { type: 'string', enum: ['moderator', 'admin'] },
  },
  required: ['userId', 'channelId', 'role'],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps, me) => {
  // Fetch the target user
  const user = await Users.findOneBy({ id: ps.userId });
  if (user == null) {
    throw new ApiError(meta.errors.noSuchUser);
  }

  // Fetch the channel
  const channel = await Channels.findOneBy({ id: ps.channelId });
  if (channel == null) {
    throw new ApiError(meta.errors.noSuchChannel);
  }

  // Ensure channel.admins and channel.moderators are arrays
  channel.admins = Array.isArray(channel.admins) ? channel.admins : [];
  channel.moderators = Array.isArray(channel.moderators) ? channel.moderators : [];

  // Check if the current user has permission to modify roles in this channel
  const isOwner = channel.userId === me.id;
  const isAdmin = channel.admins.some(admin => admin.id === me.id);
  if (!isOwner && !isAdmin) {
    throw new ApiError(meta.errors.accessDenied);
  }

  // Check if the target user is the channel owner
  if (channel.userId === user.id) {
    throw new ApiError(meta.errors.cannotRemoveOwner);
  }

  // Check if the user has the role to be removed
  const hasAdminRole = channel.admins.some(admin => admin.id === user.id);
  const hasModeratorRole = channel.moderators.some(mod => mod.id === user.id);
  if ((ps.role === 'admin' && !hasAdminRole) || (ps.role === 'moderator' && !hasModeratorRole)) {
    throw new ApiError(meta.errors.userLacksRole);
  }

  // Remove the role
  if (ps.role === 'admin') {
    channel.admins = channel.admins.filter(admin => admin.id !== user.id);
  } else {
    channel.moderators = channel.moderators.filter(mod => mod.id !== user.id);
  }

  // Save the updated channel
  await Channels.save(channel);

  return await Channels.pack(channel.id, me, {
    detail: true,
  });
});