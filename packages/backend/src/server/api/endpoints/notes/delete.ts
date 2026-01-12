import deleteNote from '@/services/note/delete.js';
import { Users, Channels, Notes } from '@/models/index.js';
import define from '../../define.js';
import { getNote } from '../../common/getters.js';
import { ApiError } from '../../error.js';
import { SECOND, HOUR } from '@/const.js';

export const meta = {
  tags: ['notes'],
  requireCredential: true,
  kind: 'write:notes',
  limit: {
    duration: HOUR,
    max: 300,
    minInterval: SECOND,
  },
  errors: {
    noSuchNote: {
      message: 'No such note.',
      code: 'NO_SUCH_NOTE',
      id: '490be23f-8c1f-4796-819f-94cb4f9d1630',
    },
    accessDenied: {
      message: 'Access denied.',
      code: 'ACCESS_DENIED',
      id: 'fe8d7103-0ea8-4ec3-814d-f8b401dc69e9',
    },
  },
} as const;

export const paramDef = {
  type: 'object',
  properties: {
    noteId: { type: 'string', format: 'campra:id' },
  },
  required: ['noteId'],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps, user) => {
  const note = await getNote(ps.noteId, user).catch(err => {
    if (err.id === '9725d0ce-ba28-4dde-95a7-2cbb2c15de24') throw new ApiError(meta.errors.noSuchNote);
    throw err;
  });

  // Check if the user has permission to delete the note
  const hasPermission = await checkNoteDeletePermission(note, user);

  if (!hasPermission) {
    throw new ApiError(meta.errors.accessDenied);
  }

  // This operation might be performed by someone other than the note author (e.g., a moderator)
  await deleteNote(await Users.findOneByOrFail({ id: note.userId }), note);
});

async function checkNoteDeletePermission(note, user) {
  // Admin and moderator can delete any note
  if (user.isAdmin || user.isModerator) {
    return true;
  }

  // Note author can delete their own note
  if (note.userId === user.id) {
    return true;
  }

  // If the note is in a channel, check channel permissions
  if (note.channelId) {
    const channel = await Channels.findOneBy({ id: note.channelId });
    if (channel) {
      // Channel owner can delete notes in their channel
      if (channel.userId === user.id) {
        return true;
      }

      // Check if user is an admin or moderator of the channel
      if (channel.admins && channel.admins.some(admin => admin.id === user.id)) {
        return true;
      }
      if (channel.moderators && channel.moderators.some(mod => mod.id === user.id)) {
        return true;
      }
    }
  }

  return false;
}