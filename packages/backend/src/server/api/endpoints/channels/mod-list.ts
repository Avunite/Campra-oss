import define from '../../define.js';
import { ApiError } from '../../error.js';
import { Channels, Users } from '@/models/index.js';
import { In } from 'typeorm';

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

  if (!channel.moderators || channel.moderators.length === 0) {
    return []; // Return an empty array if there are no moderators
  }

  // Fetch the moderator users' details
  const moderatorUsers = await Users.findBy({
    id: In(channel.moderators.map(mod => mod.id)),
  });

  // Pack the user information
  return await Promise.all(moderatorUsers.map(user => Users.pack(user, me, {
    detail: false,
  })));
});