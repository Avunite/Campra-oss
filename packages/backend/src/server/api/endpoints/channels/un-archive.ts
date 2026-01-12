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
      message: 'You do not have permission to unarchive this channel.',
      code: 'ACCESS_DENIED',
      id: 'fe8d7103-0ea8-4d3c-b17e-f685e5459d51',
    },
    notArchived: {
      message: 'This channel is not archived.',
      code: 'NOT_ARCHIVED',
      id: '18f6cf9d-2f22-4a4f-b4a3-d2a1d771f1cf',
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

  // Check if the current user has permission to unarchive this channel
  const isOwner = channel.userId === me.id;
  const isAdmin = channel.admins && channel.admins.some(admin => admin.id === me.id);
  const isCampraAdmin = me.isAdmin;
  const isCampraModerator = me.isModerator;

  if (!isOwner && !isAdmin && !isCampraAdmin && !isCampraModerator) {
    throw new ApiError(meta.errors.accessDenied);
  }

  // Check if the channel is actually archived
  if (!channel.archive) {
    throw new ApiError(meta.errors.notArchived);
  }

  // Unarchive the channel
  channel.archive = false;

  // Save the updated channel
  await Channels.save(channel);

  return {
    message: 'Channel has been unarchived successfully.',
    channel: await Channels.pack(channel.id, me, {
      detail: true,
    }),
  };
});