import { db } from '@/db/postgre.js';
import { Channel } from '@/models/entities/channel.js';
import { Packed } from '@/misc/schema.js';
import { DriveFiles, ChannelFollowings, NoteUnreads, Notes, ChannelNotePinings } from '../index.js';
import { User } from '@/models/entities/user.js';
import { In } from 'typeorm';

export type PackedChannel = {
	id: Channel['id'];
	createdAt: Channel['createdAt'];
	lastNotedAt: Channel['lastNotedAt'];
	name: Channel['name'];
	description: Channel['description'];
	userId: Channel['userId'];
	bannerUrl: string | null;
	pinnedNoteIds: Channel['pinnedNoteIds'];
	color: Channel['color'];
	isArchived: Channel['isArchived'];
	usersCount: number;
	notesCount: number;
	isFavorited?: boolean;
	hasUnreadNote?: boolean;
};

export const ChannelRepository = db.getRepository(Channel).extend({
  async pack(
    src: Channel['id'] | Channel,
    me?: { id: User['id'] } | null | undefined,
  ): Promise<Packed<'Channel'>> {
    const channel = typeof src === 'object' ? src : await this.findOneByOrFail({ id: src });
    const meId = me ? me.id : null;
    const banner = channel.bannerId ? await DriveFiles.findOneBy({ id: channel.bannerId }) : null;
    const hasUnreadNote = meId ? (await NoteUnreads.findOneBy({ noteChannelId: channel.id, userId: meId })) != null : undefined;
    const following = meId ? await ChannelFollowings.findOneBy({
      followerId: meId,
      followeeId: channel.id,
    }) : null;

    // Fetch pinned notes using ChannelNotePinings
    const channelNotePinings = await ChannelNotePinings.findBy({ channelId: channel.id });
    const pinnedNoteIds = channelNotePinings.map(pinning => pinning.noteId);
    const pinnedNotes = await Notes.findBy({ id: In(pinnedNoteIds) });

    // Ensure the channel owner is in the admins array
    const admins = channel.admins || [];
    if (!admins.some(admin => admin.id === channel.userId)) {
      admins.push({ id: channel.userId });
    }

    return {
      id: channel.id,
      createdAt: channel.createdAt.toISOString(),
      lastNotedAt: channel.lastNotedAt ? channel.lastNotedAt.toISOString() : null,
      name: channel.name,
      description: channel.description,
      userId: channel.userId,
      bannerUrl: banner ? await DriveFiles.getSecureUrl(banner, false) : null,
      usersCount: channel.usersCount,
      notesCount: channel.notesCount,
      isArchived: channel.archive,
      moderators: channel.moderators,
      admins: admins,  // Use the modified admins array
      pinnedNotes: await Promise.all(pinnedNotes.map(note => Notes.pack(note, me))),
      ...(me ? {
        isFollowing: following != null,
        hasUnreadNote,
      } : {}),
    };
  },
});