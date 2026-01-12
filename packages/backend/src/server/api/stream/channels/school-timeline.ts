import Channel from '../channel.js';
import { checkWordMute } from '@/misc/check-word-mute.js';
import { isUserRelated } from '@/misc/is-user-related.js';
import { Packed } from '@/misc/schema.js';
import { Users } from '@/models/index.js';

export default class extends Channel {
	public readonly chName = 'schoolTimeline';
	public static shouldShare = false; // Don't share between users as it's school-specific
	public static requireCredential = true; // Require authentication
	private schoolUserIds: Set<string> = new Set();

	constructor(id: string, connection: Channel['connection']) {
		super(id, connection);
		this.onNote = this.withPackedNote(this.onNote.bind(this));
	}

	public async init(params: any) {
		// Check if user has a school
		if (!this.user?.schoolId) return;

		// Get all user IDs from the same school for filtering
		const schoolUsers = await Users.find({
			where: { schoolId: this.user.schoolId, isDeleted: false },
			select: ['id'],
		});
		
		this.schoolUserIds = new Set(schoolUsers.map(u => u.id));

		// Subscribe events
		this.subscriber.on('notesStream', this.onNote);
	}

	private async onNote(note: Packed<'Note'>) {
		// Only show notes from users in the same school
		if (!this.user?.schoolId) return;
		if (note.user.host !== null) return; // Only local users
		if (note.visibility !== 'public') return;
		if (note.channelId != null && !this.followingChannels.has(note.channelId)) return;

		// Check if the note author is from the same school
		if (!this.schoolUserIds.has(note.userId)) return;
		
		// 関係ない返信は除外
		if (note.reply && !this.user!.showTimelineReplies) {
			const reply = note.reply;
			// 「チャンネル接続主への返信」でもなければ、「チャンネル接続主が行った返信」でもなければ、「投稿者の投稿者自身への返信」でもない場合
			if (reply.userId !== this.user!.id && note.userId !== this.user!.id && reply.userId !== note.userId) return;
		}

		// 流れてきたNoteがミュートしているユーザーが関わるものだったら無視する
		if (isUserRelated(note, this.muting)) return;
		// 流れてきたNoteがブロックされているユーザーが関わるものだったら無視する
		if (isUserRelated(note, this.blocking)) return;

		// 流れてきたNoteがミュートすべきNoteだったら無視する
		if (this.userProfile && await checkWordMute(note, this.user, this.userProfile.mutedWords)) return;

		this.connection.cacheNote(note);

		this.send('note', note);
	}

	public dispose() {
		// Unsubscribe events
		this.subscriber.off('notesStream', this.onNote);
	}
}
