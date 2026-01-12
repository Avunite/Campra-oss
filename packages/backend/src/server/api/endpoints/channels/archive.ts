import define from '../../define.js';
import { ApiError } from '../../error.js';
import { Channels } from '@/models/index.js';

export const meta = {
  tags: ['channels'],
  requireCredential: true,
  kind: 'write:channels',
  errors: {
    noSuchChannel: {
      message: 'No such channel.',
      code: 'NO_SUCH_CHANNEL',
      id: 'eb574755-5f2f-4221-9455-448a72be12f3',
    },
    accessDenied: {
      message: 'You do not have permission to archive this channel.',
      code: 'ACCESS_DENIED',
      id: 'fe8d7103-0ea8-4d3c-b17e-f685e5459d51',
    },
    alreadyArchived: {
      message: 'This channel is already archived.',
      code: 'ALREADY_ARCHIVED',
      id: '08e0a314-7f35-4426-a8a8-4b8daa2f6d4d',
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
  if (!me) {
    throw new Error('Authentication required');
  }

  // Fetch the channel
  const channel = await Channels.findOneBy({ id: ps.channelId });
  if (channel == null) {
    throw new ApiError(meta.errors.noSuchChannel);
  }

  // Check if the current user has permission to archive this channel
  const isOwner = channel.userId === me.id;
  const isAdmin = channel.admins && channel.admins.some(admin => admin.id === me.id);
  const isCampraAdmin = me.isAdmin;
  const isCampraModerator = me.isModerator;

  if (!isOwner && !isAdmin && !isCampraAdmin && !isCampraModerator) {
    throw new ApiError(meta.errors.accessDenied);
  }

  // Check if the channel is already archived
  if (channel.archive) {
    throw new ApiError(meta.errors.alreadyArchived);
  }

  // Archive the channel
  channel.archive = true;

  // Save the updated channel
  await Channels.save(channel);

  return {
    message: 'Channel has been archived successfully.',
    channel: await Channels.pack(channel.id, me),
  };
});