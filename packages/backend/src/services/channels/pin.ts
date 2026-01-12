import { IdentifiableError } from '@/misc/identifiable-error.js';
import { Channel } from '@/models/entities/channel.js';
import { Note } from '@/models/entities/note.js';
import { Notes, ChannelNotePinings } from '@/models/index.js';
import { ChannelNotePining } from '@/models/entities/channel-note-pining.js';
import { genId } from '@/misc/gen-id.js';

/**
 * Pin a note to a channel
 * @param channel
 * @param noteId
 */
export async function addPinned(channel: { id: Channel['id'] }, noteId: Note['id']) {
  // Fetch note to be pinned
  const note = await Notes.findOneBy({
    id: noteId,
    channelId: channel.id,
  });

  if (note == null) {
    throw new IdentifiableError('70c4e51f-5bea-449c-a030-53bee3cce202', 'No such note in this channel.');
  }

  const pinings = await ChannelNotePinings.findBy({ channelId: channel.id });
  if (pinings.length >= 10) {
    throw new IdentifiableError('15a018eb-58e5-4da1-93be-330fcc5e4e1a', 'This channel cannot pin any more notes.');
  }

  if (pinings.some(pining => pining.noteId === note.id)) {
    throw new IdentifiableError('23f0cf4e-59a3-4276-a91d-61a5891c1514', 'This note is already pinned to the channel.');
  }

  await ChannelNotePinings.insert({
    id: genId(),
    createdAt: new Date(),
    channelId: channel.id,
    noteId: note.id,
  } as ChannelNotePining);
}

/**
 * Unpin a note from a channel
 * @param channel
 * @param noteId
 */
export async function removePinned(channel: { id: Channel['id'] }, noteId: Note['id']) {
  // Fetch note to be unpinned
  const note = await Notes.findOneBy({
    id: noteId,
    channelId: channel.id,
  });

  if (note == null) {
    throw new IdentifiableError('b302d4cf-c050-400a-bbb3-be208681f40c', 'No such note in this channel.');
  }

  await ChannelNotePinings.delete({
    channelId: channel.id,
    noteId: note.id,
  });
}