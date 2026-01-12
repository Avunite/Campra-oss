import define from '../../define.js';
import { ApiError } from '../../error.js';
import { Channels, Users } from '@/models/index.js';

export const meta = {
  tags: ['channels'],
  requireCredential: true,
  kind: 'read:channels',
  errors: {
    noSuchChannel: {
      message: 'No such channel.',
      code: 'NO_SUCH_CHANNEL',
      id: 'eb574755-5f2f-4221-9455-448a72be12f3',
    },
    accessDenied: {
      message: 'You do not have permission to view the ban list of this channel.',
      code: 'ACCESS_DENIED',
      id: 'fe8d7103-0ea8-4d3c-b17e-f685e5459d51',
    },
  },
};

export const paramDef = {
  type: 'object',
  properties: {
    channelId: { type: 'string', format: 'campra:id' },
  },
  required: ['channelId'],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps, me) => {
  // Fetch the channel
  const channel = await Channels.findOneBy({ id: ps.channelId });
  if (channel == null) {
    throw new ApiError(meta.errors.noSuchChannel);
  }

  // Check if the user has permission to view the ban list
  const isOwner = channel.userId === me.id;
  const isAdmin = channel.admins && channel.admins.some(admin => admin.id === me.id);
  const isModerator = channel.moderators && channel.moderators.some(mod => mod.id === me.id);
  const isCampraSiteAdmin = me.isAdmin;

  if (!isOwner && !isAdmin && !isModerator && !isCampraSiteAdmin) {
    throw new ApiError(meta.errors.accessDenied);
  }

  // If the channel has no banned users, return an empty array
  if (!channel.banned || channel.banned.length === 0) {
    return [];
  }

  // Fetch the banned users' details
  const bannedUsers = await Users.findBy({
    id: In(channel.banned.map(b => b.id)),
  });

  // Pack the user information
  return await Promise.all(bannedUsers.map(user => Users.pack(user, me, {
    detail: false,
  })));
});