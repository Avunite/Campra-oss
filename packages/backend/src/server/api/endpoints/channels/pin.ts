import { addPinned } from '@/services/channels/pin.js';
import define from '../../define.js';
import { ApiError } from '../../error.js';
import { Channels } from '@/models/index.js';

export const meta = {
  tags: ['channels', 'notes'],
  requireCredential: true,
  kind: 'write:channels',
  errors: {
    noSuchNote: {
      message: 'No such note in this channel.',
      code: 'NO_SUCH_NOTE',
      id: '56734f8b-3928-431e-bf80-6ff87df40cb3',
    },
    pinLimitExceeded: {
      message: 'This channel cannot pin any more notes.',
      code: 'PIN_LIMIT_EXCEEDED',
      id: '72dab508-c64d-498f-8740-a8eec1ba385a',
    },
    alreadyPinned: {
      message: 'This note is already pinned to the channel.',
      code: 'ALREADY_PINNED',
      id: '8b18c2b7-68fe-4edb-9892-c0cbaeb6c913',
    },
    noSuchChannel: {
      message: 'No such channel.',
      code: 'NO_SUCH_CHANNEL',
      id: 'eb574755-5f2f-4221-9455-448a72be12f3',
    },
    accessDenied: {
      message: 'You do not have permission to pin notes in this channel.',
      code: 'ACCESS_DENIED',
      id: 'fe8d7103-0ea8-4d3c-b17e-f685e5459d51',
    },
  },
  res: {
    type: 'object',
    optional: false, nullable: false,
    ref: 'Channel',
  },
} as const;

export const paramDef = {
  type: 'object',
  properties: {
    channelId: { type: 'string', format: 'campra:id' },
    noteId: { type: 'string', format: 'campra:id' },
  },
  required: ['channelId', 'noteId'],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps, user) => {
  // Fetch the channel
  const channel = await Channels.findOneBy({ id: ps.channelId });
  if (channel == null) {
    throw new ApiError(meta.errors.noSuchChannel);
  }

  // Check if the user has permission to pin notes in this channel
  const hasPermission = await checkChannelPermission(user.id, channel);
  if (!hasPermission) {
    throw new ApiError(meta.errors.accessDenied);
  }

  await addPinned(channel, ps.noteId).catch(e => {
    if (e.id === '70c4e51f-5bea-449c-a030-53bee3cce202') throw new ApiError(meta.errors.noSuchNote);
    if (e.id === '15a018eb-58e5-4da1-93be-330fcc5e4e1a') throw new ApiError(meta.errors.pinLimitExceeded);
    if (e.id === '23f0cf4e-59a3-4276-a91d-61a5891c1514') throw new ApiError(meta.errors.alreadyPinned);
    throw e;
  });

  return await Channels.pack(channel.id, user, {
    detail: true,
  });
});

// Implement proper permission check logic
async function checkChannelPermission(userId: string, channel: Channel): Promise<boolean> {
  // Check if the user is the channel owner
  if (channel.userId === userId) {
    return true;
  }

  // Check if the user is an admin of the channel
  if (channel.admins && channel.admins.some(admin => admin.id === userId)) {
    return true;
  }

  // Check if the user is a moderator of the channel
  if (channel.moderators && channel.moderators.some(mod => mod.id === userId)) {
    return true;
  }

  // If none of the above conditions are met, the user doesn't have permission
  return false;
}